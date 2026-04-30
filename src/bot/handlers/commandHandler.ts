import TelegramBot from 'node-telegram-bot-api';
import { getMonthSummary, getRecentTransactions } from '../../models/Transaction';
import { getCategoriesByType, getCategoryByName } from '../../models/Category';
import {
  getAllSavingsBoxes,
  getSavingsBoxByName,
  createSavingsBox,
  deposit,
  withdraw,
  getTotalSaved,
} from '../../models/SavingsBox';
import {
  getAllBills,
  getBillByName,
  createBill,
  deleteBill,
  getMonthlyBillsTotal,
  getUpcomingBills,
} from '../../models/Bill';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getCurrentMonth, getMonthName, getDaysRemainingInMonth } from '../../utils/dateUtils';
import { getMainMenuKeyboard } from '../keyboards/inlineKeyboards';

// FASE 1: hardcoded no admin. Sera refeito na Fase 3 (WhatsApp + auth por numero).
const ADMIN_USER_ID = 1;

export async function handleStart(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  console.log(`📱 /start recebido - Chat ID: ${chatId} | User: ${msg.chat.first_name || msg.chat.username}`);

  const welcomeMessage = `
🤖 *Bem-vindo ao FinBot!*

Seu assistente financeiro pessoal.

*Como usar:*
Envie mensagens naturais sobre suas transacoes:
• "gastei 150 no mercado"
• "recebi 5000 de salario"
• "paguei 89,90 de luz"

*Comandos:*
/saldo - Saldo do mes
/resumo - Resumo completo
/ultimas - Ultimas transacoes
/categorias - Ver categorias
/caixinhas - Minhas caixinhas
/contas - Contas a pagar
/ajuda - Ajuda detalhada

Ou use o menu abaixo:
`;

  await bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: getMainMenuKeyboard(),
  });
}

export async function handleHelp(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;

  const helpMessage = `
📚 *Ajuda do FinBot*

*Lancando transacoes:*
Basta enviar mensagens naturais:

_Despesas:_
• "gastei 150 no mercado"
• "paguei 89,90 de luz"
• "almocei 45 reais"
• "uber 25 reais"

_Receitas:_
• "recebi 5000 de salario"
• "ganhei 200 de freelance"

_Com data:_
• "gastei 100 ontem no mercado"
• "paguei 150 dia 15"

🎤 *Audio:*
Envie uma mensagem de voz dizendo a transacao!
Ex: "gastei cinquenta reais no mercado"

📸 *Comprovantes:*
Envie foto de comprovantes PIX, notas fiscais ou recibos!

*Caixinhas (guardar dinheiro):*
• "criar caixinha VIAGEM"
• "criar caixinha CARRO meta 50000"
• "guardar 500 na VIAGEM"
• "retirar 200 da CARRO"

*Contas a Pagar (lembretes):*
• "criar conta INTERNET 99 vence dia 10"
• "nova conta LUZ 150 dia 20"
• "excluir conta INTERNET"

*Comandos:*
/saldo - Saldo do mes
/resumo - Resumo completo
/ultimas - Ultimas transacoes
/categorias - Listar categorias
/caixinhas - Ver caixinhas
/contas - Ver contas a pagar
/ajuda - Esta mensagem
`;

  await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
}

export async function handleBalance(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;

  try {
    const { year, month } = getCurrentMonth();
    const summary = await getMonthSummary(ADMIN_USER_ID, year, month);
    const monthName = getMonthName(month);

    const balanceMessage = `
💰 *Saldo de ${monthName}/${year}*

📈 Receitas: ${formatCurrency(summary.income)}
📉 Despesas: ${formatCurrency(summary.expense)}
━━━━━━━━━━━━━━━━━━
💵 *Saldo: ${formatCurrency(summary.balance)}*

${summary.balance >= 0 ? '✅ Voce esta no positivo!' : '⚠️ Atencao: saldo negativo!'}
`;

    await bot.sendMessage(chatId, balanceMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Erro ao buscar saldo:', error);
    await bot.sendMessage(chatId, '❌ Erro ao buscar saldo. Tente novamente.');
  }
}

export async function handleSummary(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;

  try {
    const { year, month } = getCurrentMonth();
    const summary = await getMonthSummary(ADMIN_USER_ID, year, month);
    const monthName = getMonthName(month);
    const daysRemaining = getDaysRemainingInMonth();

    const summaryMessage = `
📊 *Resumo de ${monthName}/${year}*

📈 *Receitas:* ${formatCurrency(summary.income)}
📉 *Despesas:* ${formatCurrency(summary.expense)}
━━━━━━━━━━━━━━━━━━
💵 *Saldo:* ${formatCurrency(summary.balance)}

📅 Faltam ${daysRemaining} dias para o fim do mes.
${summary.balance >= 0
    ? `✅ Voce pode gastar ${formatCurrency(summary.balance / (daysRemaining || 1))}/dia`
    : '⚠️ Cuidado com os gastos!'}
`;

    await bot.sendMessage(chatId, summaryMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Erro ao buscar resumo:', error);
    await bot.sendMessage(chatId, '❌ Erro ao buscar resumo. Tente novamente.');
  }
}

export async function handleRecentTransactions(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;

  try {
    const transactions = await getRecentTransactions(ADMIN_USER_ID, 10);

    if (transactions.length === 0) {
      await bot.sendMessage(chatId, '📝 Nenhuma transacao encontrada ainda.');
      return;
    }

    let message = '📝 *Ultimas Transacoes:*\n\n';

    for (const t of transactions) {
      const icon = t.type === 'income' ? '📈' : '📉';
      const sign = t.type === 'income' ? '+' : '-';
      message += `${icon} ${formatDate(t.date)}\n`;
      message += `${sign}${formatCurrency(t.amount)} - ${t.description || t.category_name}\n`;
      message += `📁 ${t.category_name}\n\n`;
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Erro ao buscar transacoes:', error);
    await bot.sendMessage(chatId, '❌ Erro ao buscar transacoes. Tente novamente.');
  }
}

export async function handleCategories(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;

  try {
    const expenseCategories = await getCategoriesByType(ADMIN_USER_ID, 'expense');
    const incomeCategories = await getCategoriesByType(ADMIN_USER_ID, 'income');

    let message = '📁 *Categorias Disponiveis:*\n\n';

    message += '*Despesas:*\n';
    for (const cat of expenseCategories) {
      message += `• ${cat.name}\n`;
    }

    message += '\n*Receitas:*\n';
    for (const cat of incomeCategories) {
      message += `• ${cat.name}\n`;
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    await bot.sendMessage(chatId, '❌ Erro ao buscar categorias. Tente novamente.');
  }
}

// =====================================================
// CAIXINHAS (Savings Boxes)
// =====================================================

export async function handleListSavingsBoxes(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;

  try {
    const boxes = await getAllSavingsBoxes(ADMIN_USER_ID);
    const total = await getTotalSaved(ADMIN_USER_ID);

    if (boxes.length === 0) {
      await bot.sendMessage(
        chatId,
        '🐷 *Caixinhas*\n\nVoce ainda nao tem nenhuma caixinha.\n\nCrie uma com:\n"criar caixinha NOME"\n\nExemplo: "criar caixinha CARRO"',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let message = '🐷 *Suas Caixinhas:*\n\n';

    for (const box of boxes) {
      const progress = box.goal_amount > 0
        ? ` (${Math.round((Number(box.current_amount) / Number(box.goal_amount)) * 100)}%)`
        : '';
      message += `📦 *${box.name}*\n`;
      message += `   💰 ${formatCurrency(Number(box.current_amount))}${progress}\n`;
      if (box.goal_amount > 0) {
        message += `   🎯 Meta: ${formatCurrency(Number(box.goal_amount))}\n`;
      }
      message += '\n';
    }

    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *Total guardado: ${formatCurrency(total)}*`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Erro ao listar caixinhas:', error);
    await bot.sendMessage(chatId, '❌ Erro ao buscar caixinhas. Tente novamente.');
  }
}

export async function handleSavingsBoxCommand(bot: TelegramBot, msg: TelegramBot.Message, text: string): Promise<void> {
  const chatId = msg.chat.id;

  try {
    const createMatch = text.match(/criar\s+caixinha\s+(\w+)(?:\s+meta\s+(\d+(?:[.,]\d{2})?))?/i);
    if (createMatch) {
      const name = createMatch[1].toUpperCase();
      const goalAmount = createMatch[2] ? parseFloat(createMatch[2].replace(',', '.')) : 0;

      const existing = await getSavingsBoxByName(ADMIN_USER_ID, name);
      if (existing) {
        await bot.sendMessage(chatId, `❌ Ja existe uma caixinha chamada "${name}".`);
        return;
      }

      await createSavingsBox(ADMIN_USER_ID, { name, goal_amount: goalAmount });
      let message = `✅ Caixinha *${name}* criada com sucesso!`;
      if (goalAmount > 0) {
        message += `\n🎯 Meta: ${formatCurrency(goalAmount)}`;
      }
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    const depositMatch = text.match(/(?:guardar|depositar|colocar)\s+(\d+(?:[.,]\d{2})?)\s+(?:na\s+)?(?:caixinha\s+)?(\w+)/i);
    if (depositMatch) {
      const amount = parseFloat(depositMatch[1].replace(',', '.'));
      const name = depositMatch[2].toUpperCase();

      const box = await getSavingsBoxByName(ADMIN_USER_ID, name);
      if (!box) {
        await bot.sendMessage(
          chatId,
          `❌ Caixinha "${name}" nao encontrada.\n\nCrie com: "criar caixinha ${name}"`
        );
        return;
      }

      await deposit(ADMIN_USER_ID, box.id, amount);
      const newBalance = Number(box.current_amount) + amount;

      let message = `✅ *Deposito realizado!*\n\n`;
      message += `📦 Caixinha: *${box.name}*\n`;
      message += `💰 Depositado: ${formatCurrency(amount)}\n`;
      message += `💵 Novo saldo: ${formatCurrency(newBalance)}`;

      if (box.goal_amount > 0) {
        const progress = Math.round((newBalance / Number(box.goal_amount)) * 100);
        message += `\n🎯 Progresso: ${progress}%`;
        if (newBalance >= Number(box.goal_amount)) {
          message += `\n\n🎉 *Parabens! Voce atingiu a meta!*`;
        }
      }

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    const withdrawMatch = text.match(/(?:retirar|tirar|sacar)\s+(\d+(?:[.,]\d{2})?)\s+(?:da\s+)?(?:caixinha\s+)?(\w+)/i);
    if (withdrawMatch) {
      const amount = parseFloat(withdrawMatch[1].replace(',', '.'));
      const name = withdrawMatch[2].toUpperCase();

      const box = await getSavingsBoxByName(ADMIN_USER_ID, name);
      if (!box) {
        await bot.sendMessage(chatId, `❌ Caixinha "${name}" nao encontrada.`);
        return;
      }

      if (Number(box.current_amount) < amount) {
        await bot.sendMessage(
          chatId,
          `❌ Saldo insuficiente na caixinha "${name}".\n💰 Saldo atual: ${formatCurrency(Number(box.current_amount))}`
        );
        return;
      }

      await withdraw(ADMIN_USER_ID, box.id, amount);
      const newBalance = Number(box.current_amount) - amount;

      const message = `✅ *Retirada realizada!*\n\n📦 Caixinha: *${box.name}*\n💸 Retirado: ${formatCurrency(amount)}\n💵 Novo saldo: ${formatCurrency(newBalance)}`;
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    const balanceMatch = text.match(/(?:saldo\s+)?(?:da\s+)?caixinha\s+(\w+)/i);
    if (balanceMatch) {
      const name = balanceMatch[1].toUpperCase();

      const box = await getSavingsBoxByName(ADMIN_USER_ID, name);
      if (!box) {
        await bot.sendMessage(chatId, `❌ Caixinha "${name}" nao encontrada.`);
        return;
      }

      let message = `📦 *Caixinha ${box.name}*\n\n`;
      message += `💰 Saldo: ${formatCurrency(Number(box.current_amount))}`;

      if (box.goal_amount > 0) {
        const progress = Math.round((Number(box.current_amount) / Number(box.goal_amount)) * 100);
        const remaining = Number(box.goal_amount) - Number(box.current_amount);
        message += `\n🎯 Meta: ${formatCurrency(Number(box.goal_amount))}`;
        message += `\n📊 Progresso: ${progress}%`;
        if (remaining > 0) {
          message += `\n📉 Faltam: ${formatCurrency(remaining)}`;
        } else {
          message += `\n\n🎉 *Meta atingida!*`;
        }
      }

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    await bot.sendMessage(
      chatId,
      `🐷 *Comandos de Caixinha:*\n\n` +
      `• /caixinhas - Ver todas as caixinhas\n` +
      `• "criar caixinha NOME" - Criar nova\n` +
      `• "criar caixinha NOME meta 1000" - Criar com meta\n` +
      `• "guardar 100 na NOME" - Depositar\n` +
      `• "retirar 50 da NOME" - Retirar\n` +
      `• "saldo caixinha NOME" - Ver saldo`,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('Erro no comando de caixinha:', error);
    await bot.sendMessage(chatId, `❌ ${error.message || 'Erro ao processar comando.'}`);
  }
}

// =====================================================
// CONTAS A PAGAR (Bills)
// =====================================================

export async function handleListBills(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;

  try {
    const bills = await getAllBills(ADMIN_USER_ID);
    const total = await getMonthlyBillsTotal(ADMIN_USER_ID);
    const upcoming = await getUpcomingBills(ADMIN_USER_ID, 7);

    if (bills.length === 0) {
      await bot.sendMessage(
        chatId,
        '📋 *Contas a Pagar*\n\nVoce ainda nao tem nenhuma conta cadastrada.\n\nCadastre com:\n"criar conta NOME VALOR vence dia X"\n\nExemplo: "criar conta INTERNET 99 vence dia 10"',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let message = '📋 *Suas Contas a Pagar:*\n\n';

    if (upcoming.length > 0) {
      message += '⚠️ *Proximas a vencer:*\n';
      for (const bill of upcoming) {
        message += `• ${bill.name} - ${formatCurrency(bill.amount)} (dia ${bill.due_day})\n`;
      }
      message += '\n';
    }

    message += '*Todas as contas:*\n';
    for (const bill of bills) {
      const recurring = bill.is_recurring ? '🔄' : '';
      message += `${recurring} *${bill.name}*\n`;
      message += `   💰 ${formatCurrency(bill.amount)} - vence dia ${bill.due_day}\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *Total mensal: ${formatCurrency(total)}*`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Erro ao listar contas:', error);
    await bot.sendMessage(chatId, '❌ Erro ao buscar contas. Tente novamente.');
  }
}

export async function handleBillCommand(bot: TelegramBot, msg: TelegramBot.Message, text: string): Promise<void> {
  const chatId = msg.chat.id;

  try {
    const createMatch = text.match(
      /(?:criar|nova|adicionar)\s+conta\s+(.+?)\s+(\d+(?:[.,]\d{2})?)\s+(?:vence\s+)?(?:dia\s+)?(\d{1,2})/i
    );
    if (createMatch) {
      const name = createMatch[1].toUpperCase().trim();
      const amount = parseFloat(createMatch[2].replace(',', '.'));
      const dueDay = parseInt(createMatch[3], 10);

      if (dueDay < 1 || dueDay > 31) {
        await bot.sendMessage(chatId, '❌ Dia de vencimento deve ser entre 1 e 31.');
        return;
      }

      let categoryId: number | undefined;
      const contasCategory = await getCategoryByName(ADMIN_USER_ID, 'Contas', 'expense');
      if (contasCategory) {
        categoryId = contasCategory.id;
      }

      await createBill(ADMIN_USER_ID, {
        name,
        amount,
        due_day: dueDay,
        category_id: categoryId,
        is_recurring: true,
        reminder_days_before: 1,
      });

      await bot.sendMessage(
        chatId,
        `✅ *Conta cadastrada!*\n\n` +
        `📝 *${name}*\n` +
        `💰 Valor: ${formatCurrency(amount)}\n` +
        `📅 Vencimento: dia ${dueDay}\n` +
        `🔔 Lembrete: 1 dia antes e no dia\n\n` +
        `_Voce sera lembrado automaticamente!_`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const deleteMatch = text.match(/(?:excluir|remover|deletar)\s+conta\s+(.+)/i);
    if (deleteMatch) {
      const name = deleteMatch[1].toUpperCase().trim();

      const bill = await getBillByName(ADMIN_USER_ID, name);
      if (!bill) {
        await bot.sendMessage(chatId, `❌ Conta "${name}" nao encontrada.`);
        return;
      }

      await deleteBill(ADMIN_USER_ID, bill.id);
      await bot.sendMessage(chatId, `✅ Conta "${bill.name}" excluida com sucesso.`);
      return;
    }

    await bot.sendMessage(
      chatId,
      `📋 *Comandos de Contas a Pagar:*\n\n` +
      `• /contas - Ver todas as contas\n` +
      `• "criar conta INTERNET 99 vence dia 10"\n` +
      `• "nova conta LUZ 150 dia 20"\n` +
      `• "excluir conta INTERNET"\n\n` +
      `_O bot lembrara 1 dia antes e no dia do vencimento!_`,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('Erro no comando de conta:', error);
    await bot.sendMessage(chatId, `❌ ${error.message || 'Erro ao processar comando.'}`);
  }
}
