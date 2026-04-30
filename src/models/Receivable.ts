import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';
import { bumpBilled, bumpPaid } from './Customer';

export type ReceivableStatus = 'pending' | 'paid';

export interface Receivable {
  id: number;
  user_id: number;
  customer_id: number;
  service_id: number | null;
  amount_cents: number;
  description: string | null;
  due_date: string;
  status: ReceivableStatus;
  paid_at: Date | null;
  payment_method: string | null;
  notes: string | null;
  snooze_until: string | null;
  last_reminder_at: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReceivableWithCustomer extends Receivable {
  customer_name: string;
  customer_phone: string | null;
}

export interface CreateReceivableDTO {
  customer_id: number;
  service_id?: number;
  amount_cents: number;
  description?: string;
  due_date: string;
  payment_method?: string;
}

export async function createReceivable(
  userId: number,
  data: CreateReceivableDTO
): Promise<number> {
  const result = await query<ResultSetHeader>(
    `INSERT INTO receivables (user_id, customer_id, service_id, amount_cents,
                              description, due_date, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.customer_id,
      data.service_id || null,
      data.amount_cents,
      data.description || null,
      data.due_date,
      data.payment_method || null,
    ]
  );
  await bumpBilled(userId, data.customer_id, data.amount_cents);
  return result.insertId;
}

export async function getReceivableById(
  userId: number,
  id: number
): Promise<ReceivableWithCustomer | null> {
  const rows = await query<ReceivableWithCustomer[]>(
    `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone
     FROM receivables r
     JOIN customers c ON r.customer_id = c.id
     WHERE r.id = ? AND r.user_id = ?`,
    [id, userId]
  );
  return rows[0] || null;
}

export async function listReceivables(
  userId: number,
  opts: {
    status?: ReceivableStatus;
    customerId?: number;
    limit?: number;
    offset?: number;
    fromDate?: string;
    toDate?: string;
  } = {}
): Promise<{ items: ReceivableWithCustomer[]; total: number }> {
  const where: string[] = ['r.user_id = ?'];
  const params: any[] = [userId];

  if (opts.status) { where.push('r.status = ?'); params.push(opts.status); }
  if (opts.customerId) { where.push('r.customer_id = ?'); params.push(opts.customerId); }
  if (opts.fromDate) { where.push('r.due_date >= ?'); params.push(opts.fromDate); }
  if (opts.toDate) { where.push('r.due_date <= ?'); params.push(opts.toDate); }

  const whereSql = where.join(' AND ');

  const totalRow = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM receivables r WHERE ${whereSql}`,
    params
  );

  const items = await query<ReceivableWithCustomer[]>(
    `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone
     FROM receivables r
     JOIN customers c ON r.customer_id = c.id
     WHERE ${whereSql}
     ORDER BY r.due_date ASC, r.id DESC
     LIMIT ? OFFSET ?`,
    [...params, opts.limit ?? 100, opts.offset ?? 0]
  );

  return { items, total: Number(totalRow[0]?.total || 0) };
}

// Lista pendentes que precisam de lembrete hoje:
// - status = pending
// - due_date <= hoje (vencidos ou vencendo)
// - snooze_until IS NULL OU snooze_until <= hoje
// - last_reminder_at != hoje (nao mandou ainda hoje)
export async function listReceivablesNeedingReminder(): Promise<
  (ReceivableWithCustomer & { user_phone: string | null; subscription_status: string | null })[]
> {
  return query<any[]>(
    `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone,
            u.phone_number AS user_phone, u.subscription_status
     FROM receivables r
     JOIN customers c ON r.customer_id = c.id
     JOIN users u ON r.user_id = u.id
     WHERE r.status = 'pending'
       AND r.due_date <= CURDATE()
       AND (r.snooze_until IS NULL OR r.snooze_until <= CURDATE())
       AND (r.last_reminder_at IS NULL OR r.last_reminder_at < CURDATE())
       AND u.is_active = TRUE
       AND u.phone_verified = TRUE
       AND u.account_type = 'business'`
  );
}

export async function markReceivableAsPaid(
  userId: number,
  id: number,
  paymentMethod?: string
): Promise<ReceivableWithCustomer | null> {
  const r = await getReceivableById(userId, id);
  if (!r || r.status === 'paid') return r;

  await query(
    `UPDATE receivables
     SET status = 'paid', paid_at = NOW(), payment_method = COALESCE(?, payment_method)
     WHERE id = ? AND user_id = ?`,
    [paymentMethod || null, id, userId]
  );
  await bumpPaid(userId, r.customer_id, r.amount_cents);

  return getReceivableById(userId, id);
}

export async function snoozeReceivable(
  userId: number,
  id: number,
  untilDate: string
): Promise<void> {
  await query(
    `UPDATE receivables SET snooze_until = ? WHERE id = ? AND user_id = ?`,
    [untilDate, id, userId]
  );
}

export async function setLastReminderAt(
  userId: number,
  id: number,
  date: string
): Promise<void> {
  await query(
    `UPDATE receivables SET last_reminder_at = ? WHERE id = ? AND user_id = ?`,
    [date, id, userId]
  );
}

export async function deleteReceivable(userId: number, id: number): Promise<void> {
  await query(`DELETE FROM receivables WHERE id = ? AND user_id = ?`, [id, userId]);
}
