// Gate: identifica o telefone, verifica plano ativo, decide se a
// mensagem segue para os handlers ou recebe resposta padrao.

import { getUserByPhone, type User } from '../models/User';
import type { MessagingClient, IncomingMessage } from '../messaging/types';
import { env } from '../config/env';

// Cooldown anti-flood para nao-cadastrados / bloqueados (1 hora).
const RATE_LIMIT_MS = 60 * 60 * 1000;
const lastReplyByPhone = new Map<string, number>();

function shouldSendStandardReply(phone: string): boolean {
  const last = lastReplyByPhone.get(phone) || 0;
  if (Date.now() - last < RATE_LIMIT_MS) return false;
  lastReplyByPhone.set(phone, Date.now());
  return true;
}

const SIGNUP_LINK = `${env.appUrl}/cadastro`;
const BILLING_LINK = `${env.appUrl}/app/billing`;

const REPLY_NOT_REGISTERED = (
  '👋 Oi! Eu sou a *Elsy*, sua assistente financeira no WhatsApp.\n\n' +
  `Para usar, faca seu cadastro em: ${SIGNUP_LINK}\n\n` +
  '_Trial gratuito de 15 dias._'
);

const REPLY_BLOCKED = (
  '📢 *Sua assinatura esta inativa*\n\n' +
  `Para reativar e voltar a usar a Elsy, atualize seu cartao em: ${BILLING_LINK}`
);

const REPLY_PHONE_NOT_VERIFIED = (
  '⏳ Quase la! Voce precisa confirmar seu telefone para usar a Elsy.\n\n' +
  'Volte ao cadastro e digite o codigo que enviamos.'
);

export interface GateResult {
  allowed: boolean;
  user?: User;
}

// Status que liberam acesso ao bot:
const ALLOWED_STATUSES = new Set(['admin', 'trialing', 'active', 'cortesia']);

export async function checkAccess(
  client: MessagingClient,
  msg: IncomingMessage
): Promise<GateResult> {
  const user = await getUserByPhone(msg.fromPhone);

  if (!user) {
    if (shouldSendStandardReply(msg.fromPhone)) {
      await client.sendText(msg.fromPhone, REPLY_NOT_REGISTERED).catch(() => {});
    }
    return { allowed: false };
  }

  if (!user.phone_verified) {
    if (shouldSendStandardReply(msg.fromPhone)) {
      await client.sendText(msg.fromPhone, REPLY_PHONE_NOT_VERIFIED).catch(() => {});
    }
    return { allowed: false };
  }

  const status = user.subscription_status;
  if (!status || !ALLOWED_STATUSES.has(status)) {
    if (shouldSendStandardReply(msg.fromPhone)) {
      await client.sendText(msg.fromPhone, REPLY_BLOCKED).catch(() => {});
    }
    return { allowed: false };
  }

  return { allowed: true, user };
}
