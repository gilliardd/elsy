import { Request, Response } from 'express';
import { verifyWebhookToken } from '../services/asaasService';
import { markProcessed } from '../models/ProcessedWebhook';
import {
  getByAsaasId as getSubscriptionByAsaas,
  updateSubscriptionStatus,
  markOverdue,
  clearOverdue,
  softDeleteSubscription,
} from '../models/Subscription';
import { upsertByAsaasId as upsertPayment } from '../models/Payment';
import { setSubscriptionStatus, getUserById } from '../models/User';
import { getMessagingClient } from '../messaging';
import { env } from '../config/env';

// Mapeamento de eventos Asaas para acoes no Elsy.
// Documentacao: https://asaasv3.docs.apiary.io/#reference/webhook
type EventHandler = (payment: any) => Promise<void>;

const PAYMENT_RECEIVED_STATUSES = new Set(['CONFIRMED', 'RECEIVED']);

async function notifyUser(userId: number, message: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user || !user.phone_number) return;
  try {
    await getMessagingClient().sendText(user.phone_number, message);
  } catch (err) {
    console.error('Erro notificando usuario', userId, err);
  }
}

async function handlePaymentReceived(payment: any): Promise<void> {
  const subAsaasId = payment.subscription;
  if (!subAsaasId) return;

  const sub = await getSubscriptionByAsaas(subAsaasId);
  if (!sub) return;

  await upsertPayment(payment.id, {
    subscription_id: sub.id,
    amount_cents: Math.round(Number(payment.value || 0) * 100),
    status: 'received',
    due_date: payment.dueDate,
    paid_at: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
    payment_method: payment.billingType,
    raw_payload: payment,
  });

  await updateSubscriptionStatus(sub.id, 'active');
  await clearOverdue(sub.id);

  // Atualiza periodo: proximo vencimento vai vir em novo evento PAYMENT_CREATED;
  // por enquanto, mantemos o current_period_end atual ate update via outro evento.
  await setSubscriptionStatus(
    sub.user_id,
    'active',
    sub.current_period_end,
    sub.id
  );

  await notifyUser(
    sub.user_id,
    `📢 *Elsy*\n\nRecebemos seu pagamento! Sua assinatura esta ativa.`
  );
}

async function handlePaymentOverdue(payment: any): Promise<void> {
  const subAsaasId = payment.subscription;
  if (!subAsaasId) return;

  const sub = await getSubscriptionByAsaas(subAsaasId);
  if (!sub) return;

  await upsertPayment(payment.id, {
    subscription_id: sub.id,
    amount_cents: Math.round(Number(payment.value || 0) * 100),
    status: 'overdue',
    due_date: payment.dueDate,
    payment_method: payment.billingType,
    raw_payload: payment,
  });

  await markOverdue(sub.id);
  await setSubscriptionStatus(sub.user_id, 'overdue', sub.current_period_end, sub.id);

  await notifyUser(
    sub.user_id,
    `📢 *Elsy*\n\nNao conseguimos processar seu pagamento. Atualize seu cartao em ${env.appUrl}/app/billing para continuar usando.`
  );
}

async function handlePaymentRefunded(payment: any): Promise<void> {
  const subAsaasId = payment.subscription;
  if (!subAsaasId) return;

  const sub = await getSubscriptionByAsaas(subAsaasId);
  if (!sub) return;

  await upsertPayment(payment.id, {
    subscription_id: sub.id,
    amount_cents: Math.round(Number(payment.value || 0) * 100),
    status: 'refunded',
    due_date: payment.dueDate,
    payment_method: payment.billingType,
    raw_payload: payment,
  });

  await updateSubscriptionStatus(sub.id, 'cancelled');
  await setSubscriptionStatus(sub.user_id, 'cancelled', null, sub.id);
}

async function handleSubscriptionDeleted(payment: any): Promise<void> {
  // Nesse evento o payload nao e payment mas { subscription }
  const subAsaasId = payment.subscription || payment.id;
  if (!subAsaasId) return;

  const sub = await getSubscriptionByAsaas(subAsaasId);
  if (!sub) return;

  await softDeleteSubscription(sub.id);
  await setSubscriptionStatus(sub.user_id, 'cancelled', null, sub.id);

  await notifyUser(
    sub.user_id,
    `📢 *Elsy*\n\nSua assinatura foi cancelada. Quando quiser voltar, e so reativar em ${env.appUrl}/app/billing.`
  );
}

async function handlePaymentUpdated(payment: any): Promise<void> {
  const subAsaasId = payment.subscription;
  if (!subAsaasId) return;
  const sub = await getSubscriptionByAsaas(subAsaasId);
  if (!sub) return;

  const status = PAYMENT_RECEIVED_STATUSES.has(payment.status)
    ? 'received'
    : payment.status === 'OVERDUE'
      ? 'overdue'
      : payment.status === 'REFUNDED'
        ? 'refunded'
        : 'pending';

  await upsertPayment(payment.id, {
    subscription_id: sub.id,
    amount_cents: Math.round(Number(payment.value || 0) * 100),
    status,
    due_date: payment.dueDate,
    paid_at: payment.paymentDate ? new Date(payment.paymentDate) : undefined,
    payment_method: payment.billingType,
    raw_payload: payment,
  });
}

const HANDLERS: Record<string, EventHandler> = {
  PAYMENT_CONFIRMED: handlePaymentReceived,
  PAYMENT_RECEIVED: handlePaymentReceived,
  PAYMENT_OVERDUE: handlePaymentOverdue,
  PAYMENT_REFUNDED: handlePaymentRefunded,
  PAYMENT_DELETED: handlePaymentRefunded,
  PAYMENT_UPDATED: handlePaymentUpdated,
  SUBSCRIPTION_DELETED: handleSubscriptionDeleted,
};

// ------------------------------------------------------------
// POST /api/webhooks/asaas
// ------------------------------------------------------------
export async function asaasWebhook(req: Request, res: Response): Promise<void> {
  const tokenHeader = req.headers['asaas-access-token'] as string | undefined;
  const tokenOk = await verifyWebhookToken(tokenHeader);
  if (!tokenOk) {
    res.status(401).json({ success: false, error: 'Token invalido' });
    return;
  }

  const event = req.body?.event as string | undefined;
  const payment = req.body?.payment;
  if (!event) {
    res.status(400).json({ success: false, error: 'Evento ausente' });
    return;
  }

  // ID do evento para idempotencia. Asaas envia 'id' do payment dentro
  // do payload; usamos como deduplicador combinado com evento.
  const eventId = `${event}:${payment?.id || req.body?.subscription?.id || Date.now()}`;
  const fresh = await markProcessed(eventId, 'asaas');
  if (!fresh) {
    res.json({ success: true, deduplicated: true });
    return;
  }

  const handler = HANDLERS[event];
  if (!handler) {
    // Evento sem tratamento explicito — apenas log e ack
    console.log(`[asaas webhook] evento ${event} sem handler; ignorando`);
    res.json({ success: true, ignored: true });
    return;
  }

  try {
    await handler(payment || req.body);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`[asaas webhook] erro processando ${event}:`, err);
    res.status(500).json({ success: false, error: 'Erro processando evento' });
  }
}
