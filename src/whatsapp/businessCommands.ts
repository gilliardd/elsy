// Comandos do bot exclusivos para contas PJ (account_type='business').
// Acionados pelo dispatcher quando o usuario for PJ.

import type { MessagingClient } from '../messaging/types';
import type { User } from '../models/User';
import {
  createCustomer,
  getCustomerByName,
  listCustomers,
  type Customer,
} from '../models/Customer';
import {
  createReceivable,
  listReceivables,
  markReceivableAsPaid,
  snoozeReceivable,
  type ReceivableWithCustomer,
} from '../models/Receivable';
import { createCashMovement, getCashSummary, getRevenueCents } from '../models/CashMovement';
import { getServiceByName, listServices } from '../models/Service';
import { setPendingAction, getPendingAction, clearPendingAction } from '../models/PendingAction';
import { formatCurrency } from '../utils/formatters';
import { normalizePhoneBR } from '../utils/validators';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function dueDateForDay(day: number): string {
  // Dado o "dia X", retorna a data deste mes (ou proximo se ja passou).
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth();
  if (day < today.getDate()) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

// ============================================================
// CADASTRO DE CLIENTE
// ============================================================

const RX_NEW_CUSTOMER = /^(?:novo\s+cliente|cadastrar\s+cliente|cliente\s+novo)\s+(.+?)(?:\s+(\d[\d\s\-\(\)]{8,}))?$/i;

export function isNewCustomerMessage(text: string): boolean {
  return RX_NEW_CUSTOMER.test(text.trim());
}

export async function handleNewCustomer(
  client: MessagingClient,
  user: User,
  text: string
): Promise<void> {
  const m = text.trim().match(RX_NEW_CUSTOMER);
  if (!m) return;

  const name = m[1].trim();
  const rawPhone = m[2];
  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizePhoneBR(rawPhone);
  }

  const existing = await getCustomerByName(user.id, name);
  if (existing) {
    await client.sendText(
      user.phone_number!,
      `❌ Ja existe um cliente "${existing.name}".`
    );
    return;
  }

  const id = await createCustomer(user.id, { name, phone: phone || undefined });

  let msg = `✅ Cliente *${name}* cadastrado!`;
  if (phone) msg += `\n📞 ${phone}`;
  await client.sendText(user.phone_number!, msg);
}

// ============================================================
// LISTAR CLIENTES
// ============================================================

export async function handleListCustomers(
  client: MessagingClient,
  user: User
): Promise<void> {
  const { customers, total } = await listCustomers(user.id, { limit: 30 });
  if (customers.length === 0) {
    await client.sendText(user.phone_number!, '👥 Voce ainda nao tem clientes cadastrados.\n\nCadastre com:\n"novo cliente NOME 11999999999"');
    return;
  }

  let msg = `👥 *Seus clientes (${total}):*\n\n`;
  for (const c of customers.slice(0, 25)) {
    msg += `• *${c.name}*`;
    if (c.phone) msg += ` — ${c.phone}`;
    msg += '\n';
  }
  if (total > 25) msg += `\n... e mais ${total - 25}.`;
  await client.sendText(user.phone_number!, msg);
}

// ============================================================
// DETALHE DO CLIENTE
// ============================================================

const RX_DETAIL_CUSTOMER = /^cliente\s+(.+)$/i;

export function isCustomerDetailMessage(text: string): boolean {
  // Evita conflito com "cliente novo" / "novo cliente"
  if (/cliente\s+novo|novo\s+cliente/i.test(text)) return false;
  return RX_DETAIL_CUSTOMER.test(text.trim());
}

export async function handleCustomerDetail(
  client: MessagingClient,
  user: User,
  text: string
): Promise<void> {
  const m = text.trim().match(RX_DETAIL_CUSTOMER);
  if (!m) return;

  const name = m[1].trim();
  const customer = await getCustomerByName(user.id, name);
  if (!customer) {
    await client.sendText(user.phone_number!, `❌ Cliente "${name}" nao encontrado.`);
    return;
  }

  const billed = customer.total_billed_cents;
  const paid = customer.total_paid_cents;
  const open = billed - paid;

  let msg = `👤 *${customer.name}*\n`;
  if (customer.phone) msg += `📞 ${customer.phone}\n`;
  if (customer.email) msg += `✉️ ${customer.email}\n`;
  msg += `\n💰 Faturado: ${formatCurrency(billed / 100)}\n`;
  msg += `✅ Pago: ${formatCurrency(paid / 100)}\n`;
  if (open > 0) msg += `⏳ Em aberto: ${formatCurrency(open / 100)}\n`;
  if (customer.last_visit_at) {
    msg += `📅 Ultima visita: ${new Date(customer.last_visit_at).toLocaleDateString('pt-BR')}\n`;
  }

  // Pendentes desse cliente
  const { items: pending } = await listReceivables(user.id, {
    status: 'pending',
    customerId: customer.id,
    limit: 10,
  });
  if (pending.length > 0) {
    msg += `\n*Pendentes:*\n`;
    for (const r of pending) {
      msg += `• ${formatCurrency(r.amount_cents / 100)} — ${r.description || 'sem descricao'} (vence ${new Date(r.due_date).toLocaleDateString('pt-BR')})\n`;
    }
  }

  await client.sendText(user.phone_number!, msg);
}

// ============================================================
// LANCAR RECEBIVEL
// Padrao: "NOME ITEM VALOR dia X"   ou   "NOME VALOR dia X"
//   "Gilliard escova 50 dia 20"
//   "Maria 30 dia 22"
// ============================================================

const RX_RECEIVABLE = /^(?<name>[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]+?)(?:\s+(?<desc>[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]*?))?\s+(?<amount>\d+(?:[.,]\d{2})?)\s+(?:vence\s+)?(?:dia\s+)?(?<day>\d{1,2})$/i;

export function isReceivableMessage(text: string): boolean {
  return RX_RECEIVABLE.test(text.trim());
}

export async function handleNewReceivable(
  client: MessagingClient,
  user: User,
  text: string
): Promise<void> {
  const m = text.trim().match(RX_RECEIVABLE);
  if (!m || !m.groups) return;

  const namePart = m.groups.name.trim();
  let descPart = (m.groups.desc || '').trim();
  const amount = parseFloat(m.groups.amount.replace(',', '.'));
  const day = parseInt(m.groups.day, 10);

  if (day < 1 || day > 31) {
    await client.sendText(user.phone_number!, '❌ Dia de vencimento deve ser entre 1 e 31.');
    return;
  }

  const customer = await getCustomerByName(user.id, namePart);
  if (!customer) {
    await client.sendText(
      user.phone_number!,
      `❌ Cliente "${namePart}" nao encontrado.\n\nCadastre com:\n"novo cliente ${namePart} 11999999999"`
    );
    return;
  }

  // Tenta achar servico pelo descPart (opcional)
  let serviceId: number | undefined;
  if (descPart) {
    const svc = await getServiceByName(user.id, descPart);
    if (svc) serviceId = svc.id;
  }

  const dueDate = dueDateForDay(day);
  const amountCents = Math.round(amount * 100);

  const id = await createReceivable(user.id, {
    customer_id: customer.id,
    service_id: serviceId,
    amount_cents: amountCents,
    description: descPart || null as any,
    due_date: dueDate,
  });

  const dueFmt = new Date(dueDate).toLocaleDateString('pt-BR');
  let msg = `✅ *Recebivel registrado!*\n\n`;
  msg += `👤 ${customer.name}\n`;
  if (descPart) msg += `📋 ${descPart}\n`;
  msg += `💰 ${formatCurrency(amount)}\n`;
  msg += `📅 Vence ${dueFmt}\n\n`;
  msg += `_Vou te lembrar no dia._`;

  await client.sendText(user.phone_number!, msg);

  // Suprimir warnings de id nao usado (id usado em log futuro)
  void id;
}

// ============================================================
// LISTAR RECEBIVEIS PENDENTES
// ============================================================

export async function handleListReceivables(
  client: MessagingClient,
  user: User
): Promise<void> {
  const { items } = await listReceivables(user.id, { status: 'pending', limit: 30 });
  if (items.length === 0) {
    await client.sendText(user.phone_number!, '📋 Sem recebiveis pendentes. 🎉');
    return;
  }

  const today = todayISO();
  const overdue = items.filter((r) => r.due_date < today);
  const todayItems = items.filter((r) => r.due_date === today);
  const upcoming = items.filter((r) => r.due_date > today);

  let msg = '📋 *Recebiveis pendentes:*\n\n';
  if (overdue.length > 0) {
    msg += '🔴 *Vencidos:*\n';
    for (const r of overdue) {
      msg += `• ${r.customer_name} — ${formatCurrency(r.amount_cents / 100)} (${new Date(r.due_date).toLocaleDateString('pt-BR')})\n`;
    }
    msg += '\n';
  }
  if (todayItems.length > 0) {
    msg += '🟡 *Vencem hoje:*\n';
    for (const r of todayItems) {
      msg += `• ${r.customer_name} — ${formatCurrency(r.amount_cents / 100)}\n`;
    }
    msg += '\n';
  }
  if (upcoming.length > 0) {
    msg += '🟢 *Proximos:*\n';
    for (const r of upcoming.slice(0, 10)) {
      msg += `• ${r.customer_name} — ${formatCurrency(r.amount_cents / 100)} (${new Date(r.due_date).toLocaleDateString('pt-BR')})\n`;
    }
  }

  const totalOpen = items.reduce((s, r) => s + r.amount_cents, 0);
  msg += `\n━━━━━━━━━━━━━━━━━━\n💰 *Total em aberto: ${formatCurrency(totalOpen / 100)}*`;

  await client.sendText(user.phone_number!, msg);
}

// ============================================================
// MARCAR RECEBIDO
// "recebi 50 do Gilliard" / "recebi 50 da Maria"
// ============================================================

const RX_RECEIVED = /^recebi\s+(\d+(?:[.,]\d{2})?)\s+(?:do|da|de)\s+(.+)$/i;

export function isReceivedMessage(text: string): boolean {
  return RX_RECEIVED.test(text.trim());
}

export async function handleReceived(
  client: MessagingClient,
  user: User,
  text: string
): Promise<void> {
  const m = text.trim().match(RX_RECEIVED);
  if (!m) return;

  const amount = parseFloat(m[1].replace(',', '.'));
  const name = m[2].trim();
  const amountCents = Math.round(amount * 100);

  const customer = await getCustomerByName(user.id, name);
  if (!customer) {
    await client.sendText(user.phone_number!, `❌ Cliente "${name}" nao encontrado.`);
    return;
  }

  // Procura recebivel pendente desse cliente com valor exato; senao o mais antigo
  const { items: pending } = await listReceivables(user.id, {
    status: 'pending',
    customerId: customer.id,
    limit: 50,
  });

  let target: ReceivableWithCustomer | undefined =
    pending.find((r) => r.amount_cents === amountCents) || pending[0];

  if (target) {
    await markReceivableAsPaid(user.id, target.id);
  } else {
    // Sem recebivel pendente — registra como cash in avulso vinculado ao cliente
    target = undefined as any;
  }

  await createCashMovement(user.id, {
    type: 'in',
    amount_cents: amountCents,
    description: `Recebimento de ${customer.name}`,
    receivable_id: target ? target.id : undefined,
    date: todayISO(),
  });

  // Resumo do caixa de hoje
  const today = todayISO();
  const summary = await getCashSummary(user.id, today, today);

  let msg = `✅ *Recebimento registrado!*\n\n`;
  msg += `👤 ${customer.name}\n`;
  msg += `💰 ${formatCurrency(amount)}\n`;
  if (target) msg += `📋 Recebivel quitado\n`;
  msg += `\n💵 Caixa hoje: ${formatCurrency(summary.inCents / 100)} (${summary.countIn} ${summary.countIn === 1 ? 'entrada' : 'entradas'})`;

  await client.sendText(user.phone_number!, msg);
}

// ============================================================
// SAIDA DO CAIXA
// "sai 100 mercado" / "saida 100 mercado"
// ============================================================

const RX_CASH_OUT = /^(?:sai|saida|gastei|paguei)\s+(\d+(?:[.,]\d{2})?)\s+(.*)$/i;

export function isCashOutMessage(text: string): boolean {
  return RX_CASH_OUT.test(text.trim());
}

export async function handleCashOut(
  client: MessagingClient,
  user: User,
  text: string
): Promise<void> {
  const m = text.trim().match(RX_CASH_OUT);
  if (!m) return;

  const amount = parseFloat(m[1].replace(',', '.'));
  const desc = m[2].trim();

  await createCashMovement(user.id, {
    type: 'out',
    amount_cents: Math.round(amount * 100),
    description: desc,
    date: todayISO(),
  });

  const today = todayISO();
  const summary = await getCashSummary(user.id, today, today);

  await client.sendText(
    user.phone_number!,
    `✅ Saida registrada: ${formatCurrency(amount)} — ${desc}\n\n` +
    `💵 Caixa hoje: entrada ${formatCurrency(summary.inCents / 100)} | saida ${formatCurrency(summary.outCents / 100)}`
  );
}

// ============================================================
// CAIXA / FATURAMENTO
// ============================================================

export async function handleCashSummary(
  client: MessagingClient,
  user: User,
  scope: 'today' | 'yesterday' | 'month'
): Promise<void> {
  let label: string;
  let from: string;
  let to: string;

  if (scope === 'today') {
    label = 'hoje';
    from = to = todayISO();
  } else if (scope === 'yesterday') {
    label = 'ontem';
    from = to = dateOffset(-1);
  } else {
    label = 'do mes';
    const now = new Date();
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    to = todayISO();
  }

  const summary = await getCashSummary(user.id, from, to);

  // Recebiveis pendentes (sempre mostra)
  const { items: pending } = await listReceivables(user.id, { status: 'pending', limit: 5 });
  const totalPending = pending.reduce((s, r) => s + r.amount_cents, 0);

  let msg = `💰 *Caixa ${label}*\n\n`;
  msg += `✅ Recebido: ${formatCurrency(summary.inCents / 100)} (${summary.countIn} ${summary.countIn === 1 ? 'entrada' : 'entradas'})\n`;
  if (summary.outCents > 0) {
    msg += `📤 Saidas: ${formatCurrency(summary.outCents / 100)} (${summary.countOut})\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 *Saldo: ${formatCurrency(summary.balanceCents / 100)}*\n`;
  }

  if (pending.length > 0 && scope === 'today') {
    msg += `\n⏳ A receber: ${formatCurrency(totalPending / 100)}\n`;
    for (const r of pending.slice(0, 3)) {
      const dueFmt = new Date(r.due_date).toLocaleDateString('pt-BR');
      msg += `• ${r.customer_name} — ${formatCurrency(r.amount_cents / 100)} (${dueFmt})\n`;
    }
  }

  await client.sendText(user.phone_number!, msg);
}

export async function handleRevenue(
  client: MessagingClient,
  user: User,
  scope: 'today' | 'yesterday' | 'month'
): Promise<void> {
  let label: string;
  let from: string;
  let to: string;

  if (scope === 'today') {
    label = 'hoje';
    from = to = todayISO();
  } else if (scope === 'yesterday') {
    label = 'ontem';
    from = to = dateOffset(-1);
  } else {
    const now = new Date();
    label = `de ${now.toLocaleString('pt-BR', { month: 'long' })}`;
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    to = todayISO();
  }

  const cents = await getRevenueCents(user.id, from, to);

  await client.sendText(
    user.phone_number!,
    `📈 *Faturamento ${label}*\n\n💰 ${formatCurrency(cents / 100)}`
  );
}

// ============================================================
// LEMBRETE DE COBRANCA: PJ marca pago / nao recebido / lembra amanha
// O scheduler cria pending_action 'collect_reminder' e o PJ responde
// 1 / 2 / 3
// ============================================================

interface CollectReminderPayload {
  receivableId: number;
}

export async function setCollectReminderPending(
  userId: number,
  receivableId: number
): Promise<void> {
  await setPendingAction<CollectReminderPayload>(
    userId,
    'collect_reminder',
    { receivableId },
    24 * 60 * 60 * 1000 // 24h
  );
}

export async function tryConsumeCollectReminder(
  client: MessagingClient,
  user: User,
  text: string
): Promise<boolean> {
  const trimmed = text.trim().toLowerCase();
  const pending = await getPendingAction<CollectReminderPayload>(user.id, 'collect_reminder');
  if (!pending) return false;

  const isPaid = ['1', 'sim', 'recebi', 'pago', 'paguei', 's', 'y'].includes(trimmed);
  const isNotYet = ['2', 'nao', 'não', 'n', 'no', 'ainda nao'].includes(trimmed);
  const isLater = /^(?:3|amanh|depois|noite)/i.test(trimmed);

  if (!isPaid && !isNotYet && !isLater) return false;

  const { receivableId } = pending.payload;

  if (isPaid) {
    const r = await markReceivableAsPaid(user.id, receivableId);
    if (r) {
      await createCashMovement(user.id, {
        type: 'in',
        amount_cents: r.amount_cents,
        description: `Recebimento de ${r.customer_name}`,
        receivable_id: r.id,
        date: todayISO(),
      });
      await client.sendText(
        user.phone_number!,
        `✅ Marcado como pago: ${r.customer_name} — ${formatCurrency(r.amount_cents / 100)}`
      );
    }
  } else if (isLater) {
    await snoozeReceivable(user.id, receivableId, dateOffset(1));
    await client.sendText(user.phone_number!, '⏰ Ok, lembro voce amanha.');
  } else {
    // isNotYet — mantem pendente, lembra amanha
    await snoozeReceivable(user.id, receivableId, dateOffset(1));
    await client.sendText(user.phone_number!, '📌 Anotado. Te aviso de novo amanha.');
  }

  await clearPendingAction(user.id, 'collect_reminder');
  return true;
}

// ============================================================
// MENU PJ
// ============================================================

export const HELP_BUSINESS = `📚 *Comandos da Elsy (PJ)*

*Clientes:*
• "novo cliente Gilliard 11999999999"
• "clientes" — lista
• "cliente Gilliard" — detalhe e historico

*Recebiveis:*
• "Gilliard escova 50 dia 20" — registra recebivel
• "receber" — lista pendentes
• "recebi 50 do Gilliard" — marca como recebido

*Caixa:*
• "caixa" / "caixa ontem" / "caixa mes"
• "sai 100 mercado" — saida do caixa
• "faturamento" / "faturamento ontem" / "faturamento mes"

*Outros:*
• "ajuda" — esta mensagem
• "menu" — esta mensagem`;
