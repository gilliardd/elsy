import { Request, Response } from 'express';
import {
  createCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
  deleteCustomer,
} from '../models/Customer';
import {
  createService,
  getServiceById,
  listServices,
  updateService,
  deleteService,
} from '../models/Service';
import {
  createReceivable,
  getReceivableById,
  listReceivables,
  markReceivableAsPaid,
  deleteReceivable,
} from '../models/Receivable';
import {
  createCashMovement,
  getCashSummary,
  listCashMovements,
  getRevenueCents,
} from '../models/CashMovement';
import { getUserById } from '../models/User';

function bad(res: Response, error: string) {
  res.status(400).json({ success: false, error });
}

async function requireBusiness(req: Request, res: Response): Promise<boolean> {
  const user = await getUserById(req.userId!);
  if (!user) {
    res.status(401).json({ success: false, error: 'Usuario nao encontrado' });
    return false;
  }
  if (user.account_type !== 'business') {
    res.status(403).json({ success: false, error: 'Endpoint disponivel apenas para contas PJ' });
    return false;
  }
  return true;
}

// ============================================================
// Customers
// ============================================================

export async function listCustomersEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const r = await listCustomers(req.userId!, {
    limit: Math.min(Number(req.query.limit) || 100, 500),
    offset: Number(req.query.offset) || 0,
    search: (req.query.search as string) || undefined,
  });
  res.json({ success: true, data: r });
}

export async function getCustomerEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const c = await getCustomerById(req.userId!, Number(req.params.id));
  if (!c) return bad(res, 'Cliente nao encontrado');
  const r = await listReceivables(req.userId!, { customerId: c.id, limit: 50 });
  res.json({ success: true, data: { customer: c, receivables: r.items } });
}

export async function createCustomerEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const { name, phone, email, cpf_cnpj, notes } = req.body || {};
  if (!name) return bad(res, 'Nome e obrigatorio');
  const id = await createCustomer(req.userId!, { name, phone, email, cpf_cnpj, notes });
  const c = await getCustomerById(req.userId!, id);
  res.status(201).json({ success: true, data: c });
}

export async function updateCustomerEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  await updateCustomer(req.userId!, Number(req.params.id), req.body || {});
  const c = await getCustomerById(req.userId!, Number(req.params.id));
  res.json({ success: true, data: c });
}

export async function deleteCustomerEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  await deleteCustomer(req.userId!, Number(req.params.id));
  res.json({ success: true });
}

// ============================================================
// Services
// ============================================================

export async function listServicesEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const items = await listServices(req.userId!, req.query.includeInactive === 'true');
  res.json({ success: true, data: items });
}

export async function createServiceEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const { name, price_cents, duration_minutes } = req.body || {};
  if (!name || price_cents === undefined) return bad(res, 'Nome e preco sao obrigatorios');
  if (price_cents < 0) return bad(res, 'Preco invalido');
  const id = await createService(req.userId!, { name, price_cents: Number(price_cents), duration_minutes });
  const s = await getServiceById(req.userId!, id);
  res.status(201).json({ success: true, data: s });
}

export async function updateServiceEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  await updateService(req.userId!, Number(req.params.id), req.body || {});
  const s = await getServiceById(req.userId!, Number(req.params.id));
  res.json({ success: true, data: s });
}

export async function deleteServiceEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  await deleteService(req.userId!, Number(req.params.id));
  res.json({ success: true });
}

// ============================================================
// Receivables
// ============================================================

export async function listReceivablesEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const r = await listReceivables(req.userId!, {
    status: req.query.status as any,
    customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
    fromDate: req.query.fromDate as string | undefined,
    toDate: req.query.toDate as string | undefined,
    limit: Math.min(Number(req.query.limit) || 100, 500),
    offset: Number(req.query.offset) || 0,
  });
  res.json({ success: true, data: r });
}

export async function createReceivableEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const { customer_id, service_id, amount_cents, description, due_date, payment_method } = req.body || {};
  if (!customer_id || !amount_cents || !due_date) {
    return bad(res, 'customer_id, amount_cents e due_date sao obrigatorios');
  }
  const id = await createReceivable(req.userId!, {
    customer_id: Number(customer_id),
    service_id: service_id ? Number(service_id) : undefined,
    amount_cents: Number(amount_cents),
    description,
    due_date,
    payment_method,
  });
  const r = await getReceivableById(req.userId!, id);
  res.status(201).json({ success: true, data: r });
}

export async function payReceivableEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const id = Number(req.params.id);
  const r = await markReceivableAsPaid(req.userId!, id, req.body?.payment_method);
  if (!r) return bad(res, 'Recebivel nao encontrado');

  // Tambem cria cash movement de entrada
  await createCashMovement(req.userId!, {
    type: 'in',
    amount_cents: r.amount_cents,
    description: `Recebimento de ${r.customer_name}`,
    receivable_id: r.id,
    date: new Date().toISOString().split('T')[0],
  });

  res.json({ success: true, data: r });
}

export async function deleteReceivableEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  await deleteReceivable(req.userId!, Number(req.params.id));
  res.json({ success: true });
}

// ============================================================
// Cash
// ============================================================

export async function cashSummaryEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const today = new Date().toISOString().split('T')[0];
  const from = (req.query.fromDate as string) || today;
  const to = (req.query.toDate as string) || today;
  const summary = await getCashSummary(req.userId!, from, to);
  const movements = await listCashMovements(req.userId!, from, to, 200);
  res.json({ success: true, data: { summary, movements, fromDate: from, toDate: to } });
}

export async function createCashMovementEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;
  const { type, amount_cents, description, category_id, date } = req.body || {};
  if (!['in', 'out'].includes(type)) return bad(res, 'type deve ser in ou out');
  if (!amount_cents || amount_cents <= 0) return bad(res, 'amount_cents invalido');
  const id = await createCashMovement(req.userId!, {
    type, amount_cents: Number(amount_cents), description, category_id, date,
  });
  res.status(201).json({ success: true, data: { id } });
}

// ============================================================
// Dashboard PJ
// ============================================================

function dateOnly(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function dashboardEndpoint(req: Request, res: Response): Promise<void> {
  if (!(await requireBusiness(req, res))) return;

  const userId = req.userId!;
  const now = new Date();
  const today = dateOnly(now);
  const yesterday = dateOnly(new Date(now.getTime() - 86400000));
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const startOfPrevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return dateOnly(d);
  })();
  const endOfPrevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 0);
    return dateOnly(d);
  })();

  const [
    todayCash,
    yesterdayCash,
    monthCash,
    prevMonthRevenue,
    pendingTotal,
    upcomingPending,
    topCustomers,
  ] = await Promise.all([
    getCashSummary(userId, today, today),
    getCashSummary(userId, yesterday, yesterday),
    getCashSummary(userId, startOfMonth, today),
    getRevenueCents(userId, startOfPrevMonth, endOfPrevMonth),
    listReceivables(userId, { status: 'pending', limit: 1 }).then((r) =>
      r.items.reduce((s, x) => s + x.amount_cents, 0)
    ),
    listReceivables(userId, { status: 'pending', limit: 10 }),
    // Top 5 clientes do mes
    (async () => {
      const { items } = await listReceivables(userId, {
        fromDate: startOfMonth, toDate: today, limit: 500,
      });
      const map = new Map<number, { name: string; total: number }>();
      for (const r of items) {
        const cur = map.get(r.customer_id) || { name: r.customer_name, total: 0 };
        if (r.status === 'paid') cur.total += r.amount_cents;
        map.set(r.customer_id, cur);
      }
      return Array.from(map.entries())
        .map(([id, v]) => ({ customer_id: id, name: v.name, total_cents: v.total }))
        .sort((a, b) => b.total_cents - a.total_cents)
        .slice(0, 5);
    })(),
  ]);

  res.json({
    success: true,
    data: {
      today: { cash: todayCash, date: today },
      yesterday: { cash: yesterdayCash, date: yesterday },
      month: { cash: monthCash, fromDate: startOfMonth, toDate: today },
      prevMonth: { revenueCents: prevMonthRevenue, fromDate: startOfPrevMonth, toDate: endOfPrevMonth },
      pending: {
        totalCents: pendingTotal,
        upcoming: upcomingPending.items.slice(0, 10),
      },
      topCustomers,
    },
  });
}
