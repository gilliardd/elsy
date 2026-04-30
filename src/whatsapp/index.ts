// Inicializacao do WhatsApp + dispatcher principal.

import { getMessagingClient } from '../messaging';
import type { IncomingMessage, MessagingClient } from '../messaging/types';
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

async function dispatch(client: MessagingClient, msg: IncomingMessage): Promise<void> {
  const access = await checkAccess(client, msg);
  if (!access.allowed || !access.user) return;

  const user = access.user;

  if (isUserRateLimited(user.id)) {
    return; // silenciosamente ignora flood
  }

  try {
    // Texto: pode ser resposta de pendente (1/2), comando, caixinha, conta ou transacao
    if (msg.text) {
      const text = msg.text.trim();

      // 1) Resposta a pendente
      if (await tryConsumeReply(client, user, text)) return;

      // 2) Comando (slash ou palavra-chave)
      if (await tryCommand(client, user, text)) return;

      // 3) Caixinhas
      if (isSavingsBoxMessage(text)) {
        await handleSavingsBoxCommand(client, user, text);
        return;
      }

      // 4) Contas
      if (isBillMessage(text)) {
        await handleBillCommand(client, user, text);
        return;
      }

      // 5) Transacao por texto
      const handled = await handleTextTransaction(client, user, text);
      if (!handled) {
        await client.sendText(
          user.phone_number!,
          '🤔 Nao entendi.\n\nTente:\n• "gastei 50 no mercado"\n• Digite *ajuda* para ver comandos.'
        );
      }
      return;
    }

    // Voz
    if (msg.voice) {
      await handleVoiceTransaction(client, user, msg);
      return;
    }

    // Imagem
    if (msg.image) {
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

  // Inicia conexao com Baileys (nao bloqueante — se falhar, reconecta).
  client.start().catch((err) => {
    console.error('Falha ao iniciar WhatsApp:', err);
  });

  // Inicia scheduler de contas a pagar (envia via mesmo adapter)
  startBillScheduler(client);

  return client;
}

export async function stopWhatsApp(): Promise<void> {
  stopBillScheduler();
  await getMessagingClient().stop();
}
