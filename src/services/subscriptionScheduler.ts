// Scheduler de manutencao de assinaturas:
// - Avisos de fim de trial (D-3 e D-1)
// - Cobrancas overdue: D+3 (2o aviso), D+7 (bloqueio), D+30 (cancelamento)
//
// Executa a cada hora. Idempotencia via colunas last_overdue_notice_at
// e checagem do dia atual.

import { query } from '../config/database';
import {
  getOverdueSubscriptions,
  setOverdueNoticeAt,
  updateSubscriptionStatus,
  softDeleteSubscription,
  type Subscription,
} from '../models/Subscription';
import { setSubscriptionStatus, getUserById } from '../models/User';
import { getMessagingClient } from '../messaging';
import { env } from '../config/env';
import {
  listReceivablesNeedingReminder,
  setLastReminderAt,
} from '../models/Receivable';
import { setCollectReminderPending } from '../whatsapp/businessCommands';

let interval: NodeJS.Timeout | null = null;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(d: Date): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / DAY_MS);
}

function daysUntil(d: Date): number {
  return Math.floor((new Date(d).getTime() - Date.now()) / DAY_MS);
}

async function notifyUser(userId: number, message: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user || !user.phone_number) return;
  try {
    await getMessagingClient().sendText(user.phone_number, message);
  } catch (err) {
    console.error('Erro notificando usuario', userId, err);
  }
}

// ------------------------------------------------------------
// Trial ending: avisa D-3 e D-1
// ------------------------------------------------------------
async function processTrialReminders(): Promise<void> {
  const subs = await query<Subscription[]>(
    `SELECT * FROM subscriptions
     WHERE deleted_at IS NULL
       AND status = 'trialing'
       AND trial_ends_at IS NOT NULL`
  );

  for (const sub of subs) {
    if (!sub.trial_ends_at) continue;
    const remaining = daysUntil(sub.trial_ends_at);

    if (remaining === 3) {
      await notifyUser(
        sub.user_id,
        `📢 *Elsy*\n\nSeu trial acaba em 3 dias. Garanta que seu cartao esta atualizado em ${env.appUrl}/app/billing para nao perder o acesso.`
      );
    } else if (remaining === 1) {
      await notifyUser(
        sub.user_id,
        `📢 *Elsy*\n\nUltimo dia de trial! Amanha sua primeira cobranca sera processada.`
      );
    }
  }
}

// ------------------------------------------------------------
// Overdue lifecycle: D+3 aviso, D+7 bloqueio, D+30 cancelamento
// ------------------------------------------------------------
async function processOverdue(): Promise<void> {
  const subs = await getOverdueSubscriptions();

  for (const sub of subs) {
    if (!sub.overdue_since) continue;
    const days = daysSince(sub.overdue_since);
    const lastNotice = sub.last_overdue_notice_at
      ? new Date(sub.last_overdue_notice_at)
      : null;
    const daysSinceNotice = lastNotice ? daysSince(lastNotice) : Infinity;

    if (days >= 30) {
      // Cancela definitivamente
      await softDeleteSubscription(sub.id);
      await setSubscriptionStatus(sub.user_id, 'cancelled', null, sub.id);
      await notifyUser(
        sub.user_id,
        `📢 *Elsy*\n\nApos 30 dias sem pagamento, sua assinatura foi cancelada definitivamente. Para voltar, faca uma nova em ${env.appUrl}/cadastro.`
      );
      continue;
    }

    if (days >= 7) {
      // Bloqueia acesso
      if (sub.status !== 'blocked') {
        await updateSubscriptionStatus(sub.id, 'blocked');
        await setSubscriptionStatus(sub.user_id, 'blocked', sub.current_period_end, sub.id);
        await notifyUser(
          sub.user_id,
          `📢 *Elsy*\n\nSua assinatura esta bloqueada por falta de pagamento. Atualize seu cartao em ${env.appUrl}/app/billing para reativar.`
        );
        await setOverdueNoticeAt(sub.id, new Date());
      }
      continue;
    }

    // 2o aviso em D+3, com cooldown de 1 dia para nao mandar todo loop
    if (days >= 3 && daysSinceNotice >= 1) {
      await notifyUser(
        sub.user_id,
        `📢 *Elsy*\n\nAinda nao processamos seu pagamento. Atualize seu cartao em ${env.appUrl}/app/billing — em ${7 - days} dia(s) o acesso sera bloqueado.`
      );
      await setOverdueNoticeAt(sub.id, new Date());
    }
  }
}

// ------------------------------------------------------------
// Cortesia expirada
// ------------------------------------------------------------
async function processCortesiaExpiration(): Promise<void> {
  const expired = await query<{ id: number }[]>(
    `SELECT id FROM users
     WHERE subscription_status = 'cortesia'
       AND cortesia_expires_at IS NOT NULL
       AND cortesia_expires_at <= NOW()`
  );

  for (const row of expired) {
    await query(
      `UPDATE users SET subscription_status = 'blocked' WHERE id = ?`,
      [row.id]
    );
    await notifyUser(
      row.id,
      `📢 *Elsy*\n\nSua cortesia expirou. Para continuar usando, contrate um plano em ${env.appUrl}/app/billing.`
    );
  }
}

// ------------------------------------------------------------
// Limpeza de pending_actions expirados (housekeeping)
// ------------------------------------------------------------
async function cleanupPendingActions(): Promise<void> {
  await query(`DELETE FROM pending_actions WHERE expires_at <= NOW()`);
}

// ------------------------------------------------------------
// Lembretes de cobranca para PJ
// Para cada recebivel pending vencido (ou vencendo hoje) sem reminder
// hoje, envia mensagem perguntando se ja foi pago.
// ------------------------------------------------------------
function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

async function processReceivableReminders(): Promise<void> {
  const ALLOWED = new Set(['admin', 'trialing', 'active', 'cortesia']);
  const items = await listReceivablesNeedingReminder();
  const today = new Date().toISOString().split('T')[0];
  const client = getMessagingClient();

  for (const r of items) {
    if (!r.user_phone) continue;
    if (!r.subscription_status || !ALLOWED.has(r.subscription_status)) continue;

    const dueFmt = new Date(r.due_date).toLocaleDateString('pt-BR');
    const isOverdue = r.due_date < today;
    const header = isOverdue
      ? `📢 *Recebivel vencido*\n\n`
      : `📢 *Recebivel vence hoje*\n\n`;

    const message =
      header +
      `👤 ${r.customer_name}\n` +
      (r.description ? `📋 ${r.description}\n` : '') +
      `💰 ${formatBRL(r.amount_cents)}\n` +
      `📅 ${dueFmt}\n\n` +
      `Ja recebeu?\n` +
      `*1* — Sim, recebi\n` +
      `*2* — Ainda nao\n` +
      `*3* — Vai pagar amanha`;

    try {
      await client.sendText(r.user_phone, message);
      await setLastReminderAt(r.user_id, r.id, today);
      await setCollectReminderPending(r.user_id, r.id);
      // Pequeno delay
      await new Promise((res) => setTimeout(res, 400));
    } catch (err) {
      console.error(`Erro enviando lembrete de recebivel ${r.id}:`, err);
    }
  }
}

export async function runSubscriptionMaintenance(): Promise<void> {
  try {
    await processTrialReminders();
    await processOverdue();
    await processCortesiaExpiration();
    await processReceivableReminders();
    await cleanupPendingActions();
  } catch (err) {
    console.error('Erro no scheduler de assinaturas:', err);
  }
}

export function startSubscriptionScheduler(): void {
  // Executa a cada hora; alguns avisos so disparam em determinadas horas do dia
  // (ex.: trial reminder so as 9h). Por simplicidade, mandamos sempre que detectamos
  // — a cadencia de envio e controlada por last_overdue_notice_at e dia exato (D-3/D-1).

  // Roda imediatamente mas em background
  runSubscriptionMaintenance().catch((err) => {
    console.error('Erro inicial no scheduler:', err);
  });

  interval = setInterval(
    () => {
      const now = new Date();
      // Janela de envio: 9h-19h. Evita spammar usuario fora desse horario.
      if (now.getHours() >= 9 && now.getHours() <= 19) {
        runSubscriptionMaintenance().catch(console.error);
      }
    },
    60 * 60 * 1000
  );

  console.log('🕐 Scheduler de assinaturas iniciado');
}

export function stopSubscriptionScheduler(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
    console.log('Scheduler de assinaturas parado');
  }
}
