import { Request, Response } from 'express';
import { query } from '../config/database';
import {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  type CreatePlanDTO,
} from '../models/Plan';
import {
  getUserById,
  setSubscriptionStatus,
  type UserWithoutPassword,
} from '../models/User';
import {
  getActiveSubscriptionByUser,
  getSubscriptionsByUser,
  updateSubscriptionStatus,
  setCancelAtPeriodEnd,
} from '../models/Subscription';
import { getPaymentsBySubscription } from '../models/Payment';
import {
  setConfig,
  getConfig,
  listConfig,
  deleteConfig,
} from '../models/SystemConfig';
import { invalidateAsaasConfigCache } from '../services/asaasService';
import { getMessagesByUser } from '../models/MessageLog';

function badRequest(res: Response, error: string) {
  res.status(400).json({ success: false, error });
}

// ============================================================
// PLANS CRUD
// ============================================================

export async function listPlans(req: Request, res: Response): Promise<void> {
  const includeInactive = req.query.includeInactive === 'true';
  const plans = await getAllPlans(includeInactive);
  res.json({ success: true, data: plans });
}

export async function createNewPlan(req: Request, res: Response): Promise<void> {
  const { name, description, price_cents, trial_days, asaas_billing_type, is_active, sort_order } = req.body || {};
  if (!name || price_cents === undefined || trial_days === undefined) {
    return badRequest(res, 'name, price_cents e trial_days sao obrigatorios');
  }
  if (price_cents < 0 || trial_days < 0) return badRequest(res, 'Valores invalidos');

  const id = await createPlan({
    name,
    description,
    price_cents: Number(price_cents),
    trial_days: Number(trial_days),
    asaas_billing_type,
    is_active,
    sort_order,
  } satisfies CreatePlanDTO);

  const plan = await getPlanById(id);
  res.status(201).json({ success: true, data: plan });
}

export async function updateExistingPlan(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const plan = await getPlanById(id);
  if (!plan) return badRequest(res, 'Plano nao encontrado');

  await updatePlan(id, req.body || {});
  const updated = await getPlanById(id);
  res.json({ success: true, data: updated });
}

export async function removeExistingPlan(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const plan = await getPlanById(id);
  if (!plan) return badRequest(res, 'Plano nao encontrado');
  await deletePlan(id);
  res.json({ success: true });
}

// ============================================================
// USERS — listagem e detalhe
// ============================================================

export async function listUsers(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const where: string[] = ['1=1'];
  const params: any[] = [];

  if (status) {
    where.push('subscription_status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(name LIKE ? OR email LIKE ? OR phone_number LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const whereSql = where.join(' AND ');

  const totalRow = await query<{ total: number }[]>(
    `SELECT COUNT(*) as total FROM users WHERE ${whereSql}`,
    params
  );

  const users = await query<UserWithoutPassword[]>(
    `SELECT id, username, name, email, phone_number, cpf,
            phone_verified, email_verified, role,
            subscription_status, subscription_expires_at,
            current_subscription_id, asaas_customer_id,
            trial_used, cortesia_expires_at, is_active,
            created_at, updated_at
     FROM users WHERE ${whereSql}
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: { users, total: Number(totalRow[0]?.total || 0), limit, offset },
  });
}

export async function getUserDetail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const user = await getUserById(id);
  if (!user) return badRequest(res, 'Usuario nao encontrado');

  const activeSub = await getActiveSubscriptionByUser(id);
  const subs = await getSubscriptionsByUser(id);
  const payments = activeSub ? await getPaymentsBySubscription(activeSub.id) : [];

  res.json({
    success: true,
    data: { user, activeSubscription: activeSub, subscriptions: subs, payments },
  });
}

// ============================================================
// USERS — acoes administrativas
// ============================================================

export async function grantCortesia(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const { expiresAt } = req.body || {};
  if (!expiresAt) return badRequest(res, 'expiresAt e obrigatorio (ISO date)');

  const user = await getUserById(id);
  if (!user) return badRequest(res, 'Usuario nao encontrado');

  const expiresDate = new Date(expiresAt);
  if (isNaN(expiresDate.getTime())) return badRequest(res, 'expiresAt invalido');

  await query(
    `UPDATE users SET subscription_status = 'cortesia',
                      subscription_expires_at = ?,
                      cortesia_expires_at = ?
     WHERE id = ?`,
    [expiresDate, expiresDate, id]
  );

  res.json({ success: true });
}

export async function extendTrial(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const { days } = req.body || {};
  if (!days || days <= 0) return badRequest(res, 'days deve ser positivo');

  const sub = await getActiveSubscriptionByUser(id);
  if (!sub || sub.status !== 'trialing') {
    return badRequest(res, 'Usuario nao esta em trial');
  }

  const currentEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
  const newEnd = new Date(currentEnd.getTime() + Number(days) * 24 * 60 * 60 * 1000);

  await query(
    `UPDATE subscriptions SET trial_ends_at = ?, current_period_end = ? WHERE id = ?`,
    [newEnd, newEnd, sub.id]
  );

  await setSubscriptionStatus(id, 'trialing', newEnd, sub.id);
  res.json({ success: true, data: { newEnd } });
}

export async function blockUser(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const sub = await getActiveSubscriptionByUser(id);
  if (sub) await updateSubscriptionStatus(sub.id, 'blocked');
  await setSubscriptionStatus(id, 'blocked', null, sub?.id || null);
  res.json({ success: true });
}

export async function unblockUser(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const { newStatus } = req.body || {};
  const target = newStatus || 'active';
  const sub = await getActiveSubscriptionByUser(id);
  if (sub) await updateSubscriptionStatus(sub.id, target);
  await setSubscriptionStatus(id, target, null, sub?.id || null);
  res.json({ success: true });
}

// ============================================================
// SYSTEM CONFIG
// ============================================================

const ASAAS_KEYS = new Set(['asaas_api_key', 'asaas_environment', 'asaas_webhook_token']);

export async function getSystemConfig(req: Request, res: Response): Promise<void> {
  const items = await listConfig();
  res.json({ success: true, data: items });
}

export async function setSystemConfig(req: Request, res: Response): Promise<void> {
  const { key } = req.params;
  const { value, isSecret, description } = req.body || {};
  if (typeof value !== 'string') return badRequest(res, 'value deve ser string');

  await setConfig(key, value, isSecret === true, description || null);

  if (ASAAS_KEYS.has(key)) {
    invalidateAsaasConfigCache();
  }

  res.json({ success: true });
}

export async function deleteSystemConfig(req: Request, res: Response): Promise<void> {
  const { key } = req.params;
  await deleteConfig(key);
  if (ASAAS_KEYS.has(key)) invalidateAsaasConfigCache();
  res.json({ success: true });
}

// ============================================================
// MENSAGENS — log por usuario
// ============================================================

export async function getUserMessages(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const messages = await getMessagesByUser(id, limit);
  res.json({ success: true, data: messages });
}
