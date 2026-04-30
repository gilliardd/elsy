import TelegramBot from 'node-telegram-bot-api';
import { parseTransactionMessage, isTransactionMessage, ParsedTransaction } from '../../services/aiService';
import { findBestCategoryMatch } from '../../models/Category';
import { createTransaction } from '../../models/Transaction';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getConfirmTransactionKeyboard } from '../keyboards/inlineKeyboards';

// FASE 1 (multi-tenancy): bot ainda atende apenas o admin via Telegram.
// A virada para WhatsApp + identificacao por numero acontece na Fase 3.
const ADMIN_USER_ID = 1;

const pendingTransactions = new Map<number, {
  parsed: ParsedTransaction;
  categoryId: number;
  messageId: number;
}>();

export function getPendingTransaction(chatId: number) {
  return pendingTransactions.get(chatId);
}

export function clearPendingTransaction(chatId: number) {
  pendingTransactions.delete(chatId);
}

export function setPendingTransaction(chatId: number, data: {
  parsed: ParsedTransaction;
  categoryId: number;
  messageId: number;
}) {
  pendingTransactions.set(chatId, data);
}

export async function handleMessage(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;
  if (text.startsWith('/')) return;

  const looksLikeTransaction = await isTransactionMessage(text);

  if (!looksLikeTransaction) {
    await bot.sendMessage(
      chatId,
      '🤔 Nao entendi sua mensagem.\n\nEnvie algo como:\n• "gastei 50 no almoco"\n• "recebi 1000 de freelance"\n\nOu use /ajuda para ver os comandos.'
    );
    return;
  }

  await bot.sendChatAction(chatId, 'typing');

  try {
    const parsed = await parseTransactionMessage(ADMIN_USER_ID, text);

    if (!parsed) {
      await bot.sendMessage(
        chatId,
        '❌ Nao consegui interpretar sua mensagem.\n\nTente ser mais especifico, por exemplo:\n• "gastei 150 no mercado"\n• "recebi 5000 de salario"'
      );
      return;
    }

    const category = await findBestCategoryMatch(ADMIN_USER_ID, parsed.category, parsed.type);

    if (!category) {
      await bot.sendMessage(chatId, '❌ Categoria nao encontrada. Tente novamente.');
      return;
    }

    const typeLabel = parsed.type === 'income' ? 'Receita' : 'Despesa';
    const typeIcon = parsed.type === 'income' ? '📈' : '📉';

    const confirmMessage = `
✅ Entendi! Confirma o lancamento?

${typeIcon} *${typeLabel}:* ${formatCurrency(parsed.amount)}
📁 *Categoria:* ${category.name}
📝 *${parsed.description}*
📅 *Data:* ${formatDate(parsed.date)}
`;

    const sentMsg = await bot.sendMessage(chatId, confirmMessage, {
      parse_mode: 'Markdown',
      reply_markup: getConfirmTransactionKeyboard(),
    });

    pendingTransactions.set(chatId, {
      parsed,
      categoryId: category.id,
      messageId: sentMsg.message_id,
    });

  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    await bot.sendMessage(chatId, '❌ Ocorreu um erro. Tente novamente.');
  }
}

export async function confirmTransaction(bot: TelegramBot, chatId: number): Promise<boolean> {
  const pending = pendingTransactions.get(chatId);

  if (!pending) {
    return false;
  }

  try {
    await createTransaction(ADMIN_USER_ID, {
      type: pending.parsed.type,
      amount: pending.parsed.amount,
      description: pending.parsed.description,
      category_id: pending.categoryId,
      date: pending.parsed.date,
      source: 'telegram',
    });

    pendingTransactions.delete(chatId);

    return true;
  } catch (error) {
    console.error('Erro ao salvar transacao:', error);
    return false;
  }
}
