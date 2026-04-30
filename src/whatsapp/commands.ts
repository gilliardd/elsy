// Comandos e palavras-chave do bot. Aceita "/saldo" e "saldo".

import type { MessagingClient } from '../messaging/types';
import type { User } from '../models/User';
import { getMonthSummary, getRecentTransactions } from '../models/Transaction';
import { getCategoriesByType, getCategoryByName } from '../models/Category';
import {
  getAllSavingsBoxes,
  getSavingsBoxByName,
  createSavingsBox,
  deposit,
  withdraw,
  getTotalSaved,
} from '../models/SavingsBox';
import {
  getAllBills,
  getBillByName,
  createBill,
  deleteBill,
  getMonthlyBillsTotal,
  getUpcomingBills,
} from '../models/Bill';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getCurrentMonth, getMonthName, getDaysRemainingInMonth } from '../utils/dateUtils';

// Mapeamento simples: comando (com ou sem /) -> handler
type CommandHandler = (client: MessagingClient, user: User, args: string) => Promise<void>;

function stripSlash(text: string): { name: string; rest: string } {
  const trimmed = text.trim();
  const noSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const sp = noSlash.indexOf(' ');
  if (sp === -1) return { name: noSlash.toLowerCase(), rest: '' };
  return { name: noSlash.slice(0, sp).toLowerCase(), rest: noSlash.slice(sp + 1).trim() };
}

const HELP_TEXT = `📚 *Como usar a Elsy*

Lance transacoes em texto natural:
• "gastei 150 no mercado"
• "recebi 5000 de salario"
• "paguei 89,90 de luz"

🎤 *Audio:* Mande um audio falando a transacao
📸 *Foto:* Mande foto de comprovante PIX/nota fiscal

*Comandos:*
• *saldo* — saldo do mes
• *resumo* — resumo do mes
• *ultimas* — ultimas transacoes
• *categorias* — listar categorias
• *caixinhas* — minhas caixinhas
• *contas* — contas a pagar
• *ajuda* — esta mensagem

*Caixinhas:*
• "criar caixinha VIAGEM"
• "guardar 500 na VIAGEM"
• "retirar 200 da VIAGEM"

*Contas a pagar:*
• "criar conta INTERNET 99 vence dia 10"
• "excluir conta INTERNET"`;

async function handleStart(client: MessagingClient, user: User): Promise<void> {
  await client.sendText(
    user.phone_number!,
    `👋 Oi *${user.name.split(' ')[0]}*! Sou a Elsy, sua assistente financeira.\n\n${HELP_TEXT}`
  );
}

async function handleHelp(client: MessagingClient, user: User): Promise<void> {
  await client.sendText(user.phone_number!, HELP_TEXT);
}

async function handleBalance(client: MessagingClient, user: User): Promise<void> {
  const { year, month } = getCurrentMonth();
  const summary = await getMonthSummary(user.id, year, month);
  const monthName = getMonthName(month);

  const msg =
    `💰 *Saldo de ${monthName}/${year}*\n\n` +
    `📈 Receitas: ${formatCurrency(summary.income)}\n` +
    `📉 Despesas: ${formatCurrency(summary.expense)}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💵 *Saldo: ${formatCurrency(summary.balance)}*\n\n` +
    `${summary.balance >= 0 ? '✅ No positivo!' : '⚠️ Atencao: saldo negativo.'}`;
  await client.sendText(user.phone_number!, msg);
}

async function handleSummary(client: MessagingClient, user: User): Promise<void> {
  const { year, month } = getCurrentMonth();
  const summary = await getMonthSummary(user.id, year, month);
  const monthName = getMonthName(month);
  const daysRemaining = getDaysRemainingInMonth();

  const msg =
    `📊 *Resumo de ${monthName}/${year}*\n\n` +
    `📈 *Receitas:* ${formatCurrency(summary.income)}\n` +
    `📉 *Despesas:* ${formatCurrency(summary.expense)}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💵 *Saldo:* ${formatCurrency(summary.balance)}\n\n` +
    `📅 Faltam ${daysRemaining} dias para o fim do mes.\n` +
    (summary.balance >= 0
      ? `✅ Voce pode gastar ${formatCurrency(summary.balance / (daysRemaining || 1))}/dia`
      : '⚠️ Cuidado com os gastos!');
  await client.sendText(user.phone_number!, msg);
}

async function handleRecent(client: MessagingClient, user: User): Promise<void> {
  const transactions = await getRecentTransactions(user.id, 10);

  if (transactions.length === 0) {
    await client.sendText(user.phone_number!, '📝 Nenhuma transacao encontrada ainda.');
    return;
  }

  let msg = '📝 *Ultimas Transacoes:*\n\n';
  for (const t of transactions) {
    const icon = t.type === 'income' ? '📈' : '📉';
    const sign = t.type === 'income' ? '+' : '-';
    msg += `${icon} ${formatDate(t.date)}\n${sign}${formatCurrency(t.amount)} — ${t.description || t.category_name}\n📁 ${t.category_name}\n\n`;
  }
  await client.sendText(user.phone_number!, msg);
}

async function handleCategories(client: MessagingClient, user: User): Promise<void> {
  const expense = await getCategoriesByType(user.id, 'expense');
  const income = await getCategoriesByType(user.id, 'income');

  let msg = '📁 *Categorias:*\n\n*Despesas:*\n';
  expense.forEach((c) => (msg += `• ${c.name}\n`));
  msg += '\n*Receitas:*\n';
  income.forEach((c) => (msg += `• ${c.name}\n`));
  await client.sendText(user.phone_number!, msg);
}

async function handleSavingsBoxes(client: MessagingClient, user: User): Promise<void> {
  const boxes = await getAllSavingsBoxes(user.id);
  const total = await getTotalSaved(user.id);

  if (boxes.length === 0) {
    await client.sendText(
      user.phone_number!,
      '🐷 *Caixinhas*\n\nVoce ainda nao tem nenhuma caixinha.\n\nCrie com:\n"criar caixinha NOME"'
    );
    return;
  }

  let msg = '🐷 *Suas Caixinhas:*\n\n';
  for (const box of boxes) {
    const progress = box.goal_amount > 0
      ? ` (${Math.round((Number(box.current_amount) / Number(box.goal_amount)) * 100)}%)`
      : '';
    msg += `📦 *${box.name}*\n   💰 ${formatCurrency(Number(box.current_amount))}${progress}\n`;
    if (box.goal_amount > 0) msg += `   🎯 Meta: ${formatCurrency(Number(box.goal_amount))}\n`;
    msg += '\n';
  }
  msg += `━━━━━━━━━━━━━━━━━━\n💵 *Total: ${formatCurrency(total)}*`;
  await client.sendText(user.phone_number!, msg);
}

async function handleBills(client: MessagingClient, user: User): Promise<void> {
  const bills = await getAllBills(user.id);
  const total = await getMonthlyBillsTotal(user.id);
  const upcoming = await getUpcomingBills(user.id, 7);

  if (bills.length === 0) {
    await client.sendText(
      user.phone_number!,
      '📋 *Contas a Pagar*\n\nVoce ainda nao tem contas cadastradas.\n\nCadastre com:\n"criar conta NOME VALOR vence dia X"'
    );
    return;
  }

  let msg = '📋 *Suas Contas:*\n\n';
  if (upcoming.length > 0) {
    msg += '⚠️ *Proximas a vencer:*\n';
    for (const b of upcoming) msg += `• ${b.name} — ${formatCurrency(b.amount)} (dia ${b.due_day})\n`;
    msg += '\n';
  }
  msg += '*Todas:*\n';
  for (const b of bills) {
    const recurring = b.is_recurring ? '🔄 ' : '';
    msg += `${recurring}*${b.name}* — ${formatCurrency(b.amount)} (dia ${b.due_day})\n`;
  }
  msg += `\n━━━━━━━━━━━━━━━━━━\n💵 *Total mensal: ${formatCurrency(total)}*`;
  await client.sendText(user.phone_number!, msg);
}

const COMMANDS: Record<string, CommandHandler> = {
  start: handleStart,
  inicio: handleStart,
  ajuda: handleHelp,
  help: handleHelp,
  menu: handleHelp,
  saldo: handleBalance,
  resumo: handleSummary,
  ultimas: handleRecent,
  recentes: handleRecent,
  categorias: handleCategories,
  caixinhas: handleSavingsBoxes,
  contas: handleBills,
};

// Tenta executar como comando. Retorna true se foi um comando reconhecido.
export async function tryCommand(
  client: MessagingClient,
  user: User,
  text: string
): Promise<boolean> {
  const { name, rest } = stripSlash(text);
  const handler = COMMANDS[name];
  if (!handler) return false;
  await handler(client, user, rest);
  return true;
}

// =====================================================
// CAIXINHAS
// =====================================================

export function isSavingsBoxMessage(text: string): boolean {
  const patterns = [
    /criar\s+caixinha/i,
    /(?:guardar|depositar|colocar)\s+\d+.*(?:caixinha|na\s+\w+)/i,
    /(?:retirar|tirar|sacar)\s+\d+.*(?:caixinha|da\s+\w+)/i,
    /(?:saldo\s+)?(?:da\s+)?caixinha\s+\w+/i,
  ];
  return patterns.some((p) => p.test(text));
}

export async function handleSavingsBoxCommand(
  client: MessagingClient,
  user: User,
  text: string
): Promise<void> {
  const phone = user.phone_number!;

  // criar caixinha NOME [meta VALOR]
  const createMatch = text.match(/criar\s+caixinha\s+(\w+)(?:\s+meta\s+(\d+(?:[.,]\d{2})?))?/i);
  if (createMatch) {
    const name = createMatch[1].toUpperCase();
    const goalAmount = createMatch[2] ? parseFloat(createMatch[2].replace(',', '.')) : 0;

    const existing = await getSavingsBoxByName(user.id, name);
    if (existing) {
      await client.sendText(phone, `❌ Ja existe uma caixinha "${name}".`);
      return;
    }

    await createSavingsBox(user.id, { name, goal_amount: goalAmount });
    let msg = `✅ Caixinha *${name}* criada!`;
    if (goalAmount > 0) msg += `\n🎯 Meta: ${formatCurrency(goalAmount)}`;
    await client.sendText(phone, msg);
    return;
  }

  // guardar/depositar VALOR na NOME
  const depositMatch = text.match(/(?:guardar|depositar|colocar)\s+(\d+(?:[.,]\d{2})?)\s+(?:na\s+)?(?:caixinha\s+)?(\w+)/i);
  if (depositMatch) {
    const amount = parseFloat(depositMatch[1].replace(',', '.'));
    const name = depositMatch[2].toUpperCase();

    const box = await getSavingsBoxByName(user.id, name);
    if (!box) {
      await client.sendText(phone, `❌ Caixinha "${name}" nao encontrada.\n\nCrie com: "criar caixinha ${name}"`);
      return;
    }

    await deposit(user.id, box.id, amount);
    const newBalance = Number(box.current_amount) + amount;

    let msg = `✅ *Deposito realizado!*\n\n📦 ${box.name}\n💰 +${formatCurrency(amount)}\n💵 Novo saldo: ${formatCurrency(newBalance)}`;
    if (box.goal_amount > 0) {
      const progress = Math.round((newBalance / Number(box.goal_amount)) * 100);
      msg += `\n🎯 Progresso: ${progress}%`;
      if (newBalance >= Number(box.goal_amount)) msg += `\n\n🎉 *Parabens! Meta atingida!*`;
    }
    await client.sendText(phone, msg);
    return;
  }

  // retirar VALOR da NOME
  const withdrawMatch = text.match(/(?:retirar|tirar|sacar)\s+(\d+(?:[.,]\d{2})?)\s+(?:da\s+)?(?:caixinha\s+)?(\w+)/i);
  if (withdrawMatch) {
    const amount = parseFloat(withdrawMatch[1].replace(',', '.'));
    const name = withdrawMatch[2].toUpperCase();

    const box = await getSavingsBoxByName(user.id, name);
    if (!box) {
      await client.sendText(phone, `❌ Caixinha "${name}" nao encontrada.`);
      return;
    }

    if (Number(box.current_amount) < amount) {
      await client.sendText(phone, `❌ Saldo insuficiente em "${name}".\n💰 Saldo atual: ${formatCurrency(Number(box.current_amount))}`);
      return;
    }

    await withdraw(user.id, box.id, amount);
    const newBalance = Number(box.current_amount) - amount;
    await client.sendText(phone, `✅ *Retirada!*\n\n📦 ${box.name}\n💸 -${formatCurrency(amount)}\n💵 Novo saldo: ${formatCurrency(newBalance)}`);
    return;
  }

  // saldo caixinha NOME
  const balanceMatch = text.match(/(?:saldo\s+)?(?:da\s+)?caixinha\s+(\w+)/i);
  if (balanceMatch) {
    const name = balanceMatch[1].toUpperCase();
    const box = await getSavingsBoxByName(user.id, name);
    if (!box) {
      await client.sendText(phone, `❌ Caixinha "${name}" nao encontrada.`);
      return;
    }

    let msg = `📦 *${box.name}*\n\n💰 Saldo: ${formatCurrency(Number(box.current_amount))}`;
    if (box.goal_amount > 0) {
      const progress = Math.round((Number(box.current_amount) / Number(box.goal_amount)) * 100);
      const remaining = Number(box.goal_amount) - Number(box.current_amount);
      msg += `\n🎯 Meta: ${formatCurrency(Number(box.goal_amount))}\n📊 Progresso: ${progress}%`;
      if (remaining > 0) msg += `\n📉 Faltam: ${formatCurrency(remaining)}`;
      else msg += `\n\n🎉 *Meta atingida!*`;
    }
    await client.sendText(phone, msg);
  }
}

// =====================================================
// CONTAS A PAGAR
// =====================================================

export function isBillMessage(text: string): boolean {
  return /(?:criar|nova|adicionar|excluir|remover|deletar)\s+conta/i.test(text);
}

export async function handleBillCommand(
  client: MessagingClient,
  user: User,
  text: string
): Promise<void> {
  const phone = user.phone_number!;

  // criar conta NOME VALOR vence dia X
  const createMatch = text.match(
    /(?:criar|nova|adicionar)\s+conta\s+(.+?)\s+(\d+(?:[.,]\d{2})?)\s+(?:vence\s+)?(?:dia\s+)?(\d{1,2})/i
  );
  if (createMatch) {
    const name = createMatch[1].toUpperCase().trim();
    const amount = parseFloat(createMatch[2].replace(',', '.'));
    const dueDay = parseInt(createMatch[3], 10);

    if (dueDay < 1 || dueDay > 31) {
      await client.sendText(phone, '❌ Dia de vencimento deve ser entre 1 e 31.');
      return;
    }

    let categoryId: number | undefined;
    const cat = await getCategoryByName(user.id, 'Contas', 'expense');
    if (cat) categoryId = cat.id;

    await createBill(user.id, {
      name,
      amount,
      due_day: dueDay,
      category_id: categoryId,
      is_recurring: true,
      reminder_days_before: 1,
    });

    await client.sendText(
      phone,
      `✅ *Conta cadastrada!*\n\n📝 ${name}\n💰 ${formatCurrency(amount)}\n📅 Vence dia ${dueDay}\n🔔 Lembrete: 1 dia antes\n\n_Vou te lembrar automaticamente!_`
    );
    return;
  }

  // excluir conta NOME
  const deleteMatch = text.match(/(?:excluir|remover|deletar)\s+conta\s+(.+)/i);
  if (deleteMatch) {
    const name = deleteMatch[1].toUpperCase().trim();
    const bill = await getBillByName(user.id, name);
    if (!bill) {
      await client.sendText(phone, `❌ Conta "${name}" nao encontrada.`);
      return;
    }
    await deleteBill(user.id, bill.id);
    await client.sendText(phone, `✅ Conta "${bill.name}" excluida.`);
  }
}
