// Fluxo de transacao: parse de mensagem (texto/audio/imagem),
// pendente em pending_actions, confirmacao via "1" ou "2".

import type { MessagingClient, IncomingMessage } from '../messaging/types';
import type { User } from '../models/User';
import {
  parseTransactionMessage,
  isTransactionMessage,
  parseReceiptImage,
  transcribeAudio,
  type ParsedTransaction,
} from '../services/aiService';
import { findBestCategoryMatch } from '../models/Category';
import { createTransaction } from '../models/Transaction';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  setPendingAction,
  getPendingAction,
  clearPendingAction,
} from '../models/PendingAction';

const PENDING_TYPE = 'transaction_confirm';

interface PendingTransactionPayload {
  parsed: ParsedTransaction;
  categoryId: number;
  source: 'text' | 'voice' | 'image';
}

function buildConfirmMessage(parsed: ParsedTransaction, categoryName: string, headerIcon: string): string {
  const typeLabel = parsed.type === 'income' ? 'Receita' : 'Despesa';
  const typeIcon = parsed.type === 'income' ? '📈' : '📉';
  return (
    `${headerIcon} *Confirma o lancamento?*\n\n` +
    `${typeIcon} *${typeLabel}:* ${formatCurrency(parsed.amount)}\n` +
    `📁 *Categoria:* ${categoryName}\n` +
    `📝 ${parsed.description}\n` +
    `📅 ${formatDate(parsed.date)}\n\n` +
    `*1* — Confirmar\n*2* — Cancelar`
  );
}

export async function handleTextTransaction(
  client: MessagingClient,
  user: User,
  text: string
): Promise<boolean> {
  if (!(await isTransactionMessage(text))) return false;

  const parsed = await parseTransactionMessage(user.id, text);
  if (!parsed) {
    await client.sendText(
      user.phone_number!,
      '🤔 Nao consegui interpretar. Tente algo como:\n• "gastei 150 no mercado"\n• "recebi 5000 de salario"'
    );
    return true;
  }

  const category = await findBestCategoryMatch(user.id, parsed.category, parsed.type);
  if (!category) {
    await client.sendText(user.phone_number!, '❌ Categoria nao encontrada.');
    return true;
  }

  await setPendingAction<PendingTransactionPayload>(user.id, PENDING_TYPE, {
    parsed,
    categoryId: category.id,
    source: 'text',
  });

  await client.sendText(
    user.phone_number!,
    buildConfirmMessage(parsed, category.name, '✅')
  );
  return true;
}

export async function handleVoiceTransaction(
  client: MessagingClient,
  user: User,
  msg: IncomingMessage
): Promise<void> {
  if (!msg.voice) return;

  if (msg.voice.durationSeconds && msg.voice.durationSeconds > 60) {
    await client.sendText(user.phone_number!, '⚠️ Audio muito longo. Envie audios de ate 1 minuto.');
    return;
  }

  await client.sendText(user.phone_number!, '🎤 Transcrevendo audio...');

  const transcription = await transcribeAudio(msg.voice.buffer, 'voice.ogg');
  if (!transcription) {
    await client.sendText(user.phone_number!, '❌ Nao consegui transcrever. Tente por texto.');
    return;
  }

  await client.sendText(user.phone_number!, `📝 Entendi: "${transcription}"\n\nProcessando...`);

  const parsed = await parseTransactionMessage(user.id, transcription);
  if (!parsed) {
    await client.sendText(
      user.phone_number!,
      `❌ Nao consegui identificar uma transacao.\n\nVoce disse: "${transcription}"`
    );
    return;
  }

  const category = await findBestCategoryMatch(user.id, parsed.category, parsed.type);
  if (!category) {
    await client.sendText(user.phone_number!, '❌ Categoria nao encontrada.');
    return;
  }

  await setPendingAction<PendingTransactionPayload>(user.id, PENDING_TYPE, {
    parsed,
    categoryId: category.id,
    source: 'voice',
  });

  await client.sendText(
    user.phone_number!,
    buildConfirmMessage(parsed, category.name, '🎤')
  );
}

export async function handleImageTransaction(
  client: MessagingClient,
  user: User,
  msg: IncomingMessage
): Promise<void> {
  if (!msg.image) return;

  await client.sendText(user.phone_number!, '🔍 Analisando comprovante...');

  const base64 = msg.image.buffer.toString('base64');
  const parsed = await parseReceiptImage(user.id, base64);
  if (!parsed) {
    await client.sendText(
      user.phone_number!,
      '❌ Nao consegui identificar uma transacao na imagem.\n\nEnvie uma foto clara de:\n• Comprovante PIX\n• Nota fiscal\n• Recibo'
    );
    return;
  }

  const category = await findBestCategoryMatch(user.id, parsed.category, parsed.type);
  if (!category) {
    await client.sendText(user.phone_number!, '❌ Categoria nao encontrada.');
    return;
  }

  await setPendingAction<PendingTransactionPayload>(user.id, PENDING_TYPE, {
    parsed,
    categoryId: category.id,
    source: 'image',
  });

  await client.sendText(
    user.phone_number!,
    buildConfirmMessage(parsed, category.name, '📸')
  );
}

// Tenta interpretar resposta como confirmacao de transacao pendente.
// Retorna true se consumiu (havia pendente).
export async function tryConsumeReply(
  client: MessagingClient,
  user: User,
  text: string
): Promise<boolean> {
  const trimmed = text.trim().toLowerCase();
  const pending = await getPendingAction<PendingTransactionPayload>(user.id, PENDING_TYPE);
  if (!pending) return false;

  const isConfirm = ['1', 'sim', 'confirmar', 'confirma', 's', 'y', 'yes'].includes(trimmed);
  const isCancel = ['2', 'nao', 'não', 'cancelar', 'cancela', 'n', 'no'].includes(trimmed);

  if (!isConfirm && !isCancel) return false;

  if (isConfirm) {
    try {
      await createTransaction(user.id, {
        type: pending.payload.parsed.type,
        amount: pending.payload.parsed.amount,
        description: pending.payload.parsed.description,
        category_id: pending.payload.categoryId,
        date: pending.payload.parsed.date,
        source: `whatsapp_${pending.payload.source}`,
      });
      await client.sendText(
        user.phone_number!,
        `✅ *Lancamento registrado!*\n\n💰 ${formatCurrency(pending.payload.parsed.amount)}\n📝 ${pending.payload.parsed.description}`
      );
    } catch (err) {
      console.error('Erro ao registrar transacao:', err);
      await client.sendText(user.phone_number!, '❌ Erro ao registrar. Tente novamente.');
    }
  } else {
    await client.sendText(user.phone_number!, '❌ Cancelado.');
  }

  await clearPendingAction(user.id, PENDING_TYPE);
  return true;
}
