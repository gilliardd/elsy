// Inicializacao do WhatsApp + dispatcher principal.

import { getMessagingClient } from '../messaging';
import type { IncomingMessage, MessagingClient } from '../messaging/types';
import type { User } from '../models/User';
import { checkAccess } from './gate';
import {
  tryCommand,
  isSavingsBoxMessage,
  isBillMessage,
  handleSavingsBoxCommand,
  handleBillCommand,
} from './commands';
import {
  handleTextTransaction,
  handleVoiceTransaction,
  handleImageTransaction,
  tryConsumeReply,
} from './transactionFlow';
import {
  isNewCustomerMessage,
  handleNewCustomer,
  handleListCustomers,
  isCustomerDetailMessage,
  handleCustomerDetail,
  isReceivableMessage,
  handleNewReceivable,
  handleListReceivables,
  isReceivedMessage,
  handleReceived,
  isCashOutMessage,
  handleCashOut,
  handleCashSummary,
  handleRevenue,
  tryConsumeCollectReminder,
  HELP_BUSINESS,
} from './businessCommands';
import { startBillScheduler, stopBillScheduler } from '../services/billScheduler';

// Rate limit por usuario para evitar flood (1 msg/seg).
const lastMessageByUser = new Map<number, number>();
const USER_RATE_LIMIT_MS = 1_000;

function isUserRateLimited(userId: number): boolean {
  const last = lastMessageByUser.get(userId) || 0;
  if (Date.now() - last < USER_RATE_LIMIT_MS) return true;
  lastMessageByUser.set(userId, Date.now());
  return false;
}

// ------------------------------------------------------------
// Dispatch para PJ (account_type='business')
// ------------------------------------------------------------
async function dispatchBusiness(
  client: MessagingClient,
  user: User,
  text: string
): Promise<boolean> {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1) Resposta a lembrete de cobranca (pending_action collect_reminder)
  if (await tryConsumeCollectReminder(client, user, trimmed)) return true;

  // 2) Comandos exatos curtos
  if (['ajuda', 'help', 'menu', 'start', 'inicio', '?'].includes(lower)) {
    await client.sendText(user.phone_number!, HELP_BUSINESS);
    return true;
  }
  if (lower === 'clientes') {
    await handleListCustomers(client, user);
    return true;
  }
  if (lower === 'receber' || lower === 'recebiveis' || lower === 'receberes') {
    await handleListReceivables(client, user);
    return true;
  }
  if (lower === 'caixa' || lower === 'caixa hoje' || lower === 'fechamento') {
    await handleCashSummary(client, user, 'today');
    return true;
  }
  if (lower === 'caixa ontem') {
    await handleCashSummary(client, user, 'yesterday');
    return true;
  }
  if (lower === 'caixa mes' || lower === 'caixa do mes') {
    await handleCashSummary(client, user, 'month');
    return true;
  }
  if (lower === 'faturamento' || lower === 'faturamento hoje') {
    await handleRevenue(client, user, 'today');
    return true;
  }
  if (lower === 'faturamento ontem') {
    await handleRevenue(client, user, 'yesterday');
    return true;
  }
  if (lower === 'faturamento mes' || lower === 'faturamento do mes') {
    await handleRevenue(client, user, 'month');
    return true;
  }

  // 3) Comandos com argumentos
  if (isNewCustomerMessage(trimmed)) {
    await handleNewCustomer(client, user, trimmed);
    return true;
  }
  if (isReceivedMessage(trimmed)) {
    await handleReceived(client, user, trimmed);
    return true;
  }
  if (isCashOutMessage(trimmed)) {
    await handleCashOut(client, user, trimmed);
    return true;
  }
  if (isCustomerDetailMessage(trimmed)) {
    await handleCustomerDetail(client, user, trimmed);
    return true;
  }
  // O receivable e o ultimo porque o regex e mais permissivo
  if (isReceivableMessage(trimmed)) {
    await handleNewReceivable(client, user, trimmed);
    return true;
  }

  return false;
}

// ------------------------------------------------------------
// Dispatch principal
// ------------------------------------------------------------
async function dispatch(client: MessagingClient, msg: IncomingMessage): Promise<void> {
  const access = await checkAccess(client, msg);
  if (!access.allowed || !access.user) return;

  const user = access.user;

  if (isUserRateLimited(user.id)) {
    return;
  }

  try {
    if (msg.text) {
      const text = msg.text.trim();

      if (user.account_type === 'business') {
        // PJ: handlers proprios — se nada bater, mostra menu PJ
        if (await dispatchBusiness(client, user, text)) return;
        await client.sendText(
          user.phone_number!,
          '🤔 Nao entendi.\n\nDigite *menu* ou *ajuda* para ver as opcoes.'
        );
        return;
      }

      // PF: fluxo original
      if (await tryConsumeReply(client, user, text)) return;
      if (await tryCommand(client, user, text)) return;
      if (isSavingsBoxMessage(text)) {
        await handleSavingsBoxCommand(client, user, text);
        return;
      }
      if (isBillMessage(text)) {
        await handleBillCommand(client, user, text);
        return;
      }
      const handled = await handleTextTransaction(client, user, text);
      if (!handled) {
        await client.sendText(
          user.phone_number!,
          '🤔 Nao entendi.\n\nTente:\n• "gastei 50 no mercado"\n• Digite *ajuda* para ver comandos.'
        );
      }
      return;
    }

    if (msg.voice) {
      // PJ ainda nao tem fluxo de voz especifico — usa o de transacao para PF
      if (user.account_type === 'business') {
        await client.sendText(user.phone_number!, '🎤 Audio ainda nao e suportado para conta PJ. Use texto.');
        return;
      }
      await handleVoiceTransaction(client, user, msg);
      return;
    }

    if (msg.image) {
      if (user.account_type === 'business') {
        await client.sendText(user.phone_number!, '📸 Foto ainda nao e suportada para conta PJ.');
        return;
      }
      await handleImageTransaction(client, user, msg);
      return;
    }
  } catch (err) {
    console.error('Erro processando mensagem do usuario', user.id, err);
    try {
      await client.sendText(
        user.phone_number!,
        '❌ Tive um problema processando sua mensagem. Tente de novo em instantes.'
      );
    } catch {}
  }
}

let started = false;

export async function startWhatsApp(): Promise<MessagingClient> {
  const client = getMessagingClient();
  if (started) return client;
  started = true;

  client.onMessage((msg) => dispatch(client, msg));

  client.start().catch((err) => {
    console.error('Falha ao iniciar WhatsApp:', err);
  });

  startBillScheduler(client);

  return client;
}

export async function stopWhatsApp(): Promise<void> {
  stopBillScheduler();
  await getMessagingClient().stop();
}
