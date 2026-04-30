import { query } from '../config/database';
import {
  getAllBills,
  updateLastReminderDate,
  type BillWithCategory,
} from '../models/Bill';
import type { MessagingClient } from '../messaging/types';

let schedulerInterval: NodeJS.Timeout | null = null;

interface UserPhone {
  id: number;
  phone_number: string;
  subscription_status: string | null;
}

const ALLOWED_STATUSES = new Set(['admin', 'trialing', 'active', 'cortesia']);

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

async function getUsersToNotify(): Promise<UserPhone[]> {
  return query<UserPhone[]>(
    `SELECT id, phone_number, subscription_status
     FROM users
     WHERE is_active = TRUE AND phone_verified = TRUE AND phone_number IS NOT NULL`
  );
}

function buildReminderMessage(bill: BillWithCategory, daysUntilDue: number): string {
  let header: string;
  if (daysUntilDue === 0) header = `📢 *CONTA VENCE HOJE!*\n\n`;
  else if (daysUntilDue === 1) header = `📢 *Lembrete: conta vence amanha!*\n\n`;
  else header = `📢 *Lembrete de conta a pagar*\n\n`;

  let msg =
    header +
    `📝 *${bill.name}*\n` +
    `💰 Valor: *${formatCurrency(bill.amount)}*\n` +
    `📅 Vencimento: dia *${bill.due_day}*\n`;

  if (bill.category_name) msg += `🏷️ Categoria: ${bill.category_name}\n`;
  if (bill.description) msg += `📋 ${bill.description}\n`;

  msg += `\nApos pagar, mande "criar conta paga ${bill.name}" ou marque pelo painel.`;
  return msg;
}

async function notifyUserBills(client: MessagingClient, user: UserPhone): Promise<void> {
  if (!user.subscription_status || !ALLOWED_STATUSES.has(user.subscription_status)) {
    return; // Nao notifica usuarios sem plano ativo
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentDay = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();

  const bills = await getAllBills(user.id);

  for (const bill of bills) {
    let daysUntilDue: number;
    if (bill.due_day >= currentDay) daysUntilDue = bill.due_day - currentDay;
    else daysUntilDue = lastDayOfMonth - currentDay + bill.due_day;

    if (bill.last_reminder_date === todayStr) continue;

    if (bill.last_paid_date) {
      const paid = new Date(bill.last_paid_date);
      if (
        paid.getMonth() + 1 === currentMonth &&
        paid.getFullYear() === currentYear
      ) {
        continue;
      }
    }

    if (daysUntilDue <= bill.reminder_days_before) {
      try {
        await client.sendText(user.phone_number, buildReminderMessage(bill, daysUntilDue));
        await updateLastReminderDate(user.id, bill.id, todayStr);
        // Pequeno delay entre envios pra evitar trigger anti-spam do WhatsApp
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(
          `Erro enviando lembrete (user ${user.id}, bill ${bill.id}):`,
          err
        );
      }
    }
  }
}

export async function checkAndSendReminders(client: MessagingClient): Promise<void> {
  try {
    const users = await getUsersToNotify();
    for (const user of users) {
      await notifyUserBills(client, user);
    }
  } catch (err) {
    console.error('Erro no scheduler de bills:', err);
  }
}

export function startBillScheduler(client: MessagingClient): void {
  // Executa imediatamente
  checkAndSendReminders(client).catch(console.error);

  // Depois a cada hora; envia apenas as 9h e as 18h
  schedulerInterval = setInterval(
    () => {
      const now = new Date();
      if (now.getHours() === 9 || now.getHours() === 18) {
        checkAndSendReminders(client).catch(console.error);
      }
    },
    60 * 60 * 1000
  );

  console.log('📅 Scheduler de contas a pagar iniciado');
}

export function stopBillScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Scheduler de contas parado');
  }
}
