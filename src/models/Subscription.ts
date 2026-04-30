import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export type SubscriptionStatus = 'trialing' | 'active' | 'overdue' | 'blocked' | 'cancelled';

export interface Subscription {
  id: number;
  user_id: number;
  plan_id: number;
  asaas_subscription_id: string | null;
  status: SubscriptionStatus;
  started_at: Date | null;
  trial_ends_at: Date | null;
  current_period_end: Date | null;
  overdue_since: Date | null;
  last_overdue_notice_at: Date | null;
  cancel_at_period_end: boolean;
  cancelled_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSubscriptionDTO {
  user_id: number;
  plan_id: number;
  asaas_subscription_id?: string;
  status?: SubscriptionStatus;
  started_at?: Date;
  trial_ends_at?: Date;
  current_period_end?: Date;
}

export async function createSubscription(data: CreateSubscriptionDTO): Promise<number> {
  const result = await query<ResultSetHeader>(
    `INSERT INTO subscriptions (user_id, plan_id, asaas_subscription_id, status,
                                started_at, trial_ends_at, current_period_end)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.plan_id,
      data.asaas_subscription_id || null,
      data.status || 'trialing',
      data.started_at || null,
      data.trial_ends_at || null,
      data.current_period_end || null,
    ]
  );
  return result.insertId;
}

export async function getSubscriptionById(id: number): Promise<Subscription | null> {
  const rows = await query<Subscription[]>(
    `SELECT * FROM subscriptions WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
}

export async function getActiveSubscriptionByUser(userId: number): Promise<Subscription | null> {
  const rows = await query<Subscription[]>(
    `SELECT * FROM subscriptions
     WHERE user_id = ? AND deleted_at IS NULL
       AND status IN ('trialing', 'active', 'overdue')
     ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function getSubscriptionsByUser(userId: number): Promise<Subscription[]> {
  return query<Subscription[]>(
    `SELECT * FROM subscriptions
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY id DESC`,
    [userId]
  );
}

export async function getByAsaasId(asaasId: string): Promise<Subscription | null> {
  const rows = await query<Subscription[]>(
    `SELECT * FROM subscriptions WHERE asaas_subscription_id = ? AND deleted_at IS NULL`,
    [asaasId]
  );
  return rows[0] || null;
}

export async function updateSubscriptionStatus(
  id: number,
  status: SubscriptionStatus
): Promise<void> {
  await query(`UPDATE subscriptions SET status = ? WHERE id = ?`, [status, id]);
}

export async function setCancelAtPeriodEnd(id: number, value: boolean): Promise<void> {
  await query(
    `UPDATE subscriptions SET cancel_at_period_end = ? WHERE id = ?`,
    [value, id]
  );
}

export async function softDeleteSubscription(id: number): Promise<void> {
  await query(
    `UPDATE subscriptions SET deleted_at = NOW(), status = 'cancelled', cancelled_at = NOW()
     WHERE id = ?`,
    [id]
  );
}

export async function markOverdue(id: number, since?: Date): Promise<void> {
  await query(
    `UPDATE subscriptions
     SET status = 'overdue',
         overdue_since = COALESCE(overdue_since, ?)
     WHERE id = ?`,
    [since || new Date(), id]
  );
}

export async function clearOverdue(id: number): Promise<void> {
  await query(
    `UPDATE subscriptions
     SET overdue_since = NULL, last_overdue_notice_at = NULL
     WHERE id = ?`,
    [id]
  );
}

export async function setOverdueNoticeAt(id: number, at: Date): Promise<void> {
  await query(
    `UPDATE subscriptions SET last_overdue_notice_at = ? WHERE id = ?`,
    [at, id]
  );
}

// Subscriptions com status='overdue' (para o scheduler de cobranca)
export async function getOverdueSubscriptions(): Promise<
  (Subscription & { user_phone: string | null; user_id_internal: number })[]
> {
  return query<any[]>(
    `SELECT s.*, u.phone_number AS user_phone, u.id AS user_id_internal
     FROM subscriptions s
     JOIN users u ON s.user_id = u.id
     WHERE s.deleted_at IS NULL
       AND s.status = 'overdue'
       AND u.is_active = TRUE
     ORDER BY s.overdue_since ASC`
  );
}
