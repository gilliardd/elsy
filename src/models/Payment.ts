import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export type PaymentStatus =
  | 'pending'
  | 'confirmed'
  | 'received'
  | 'overdue'
  | 'refunded'
  | 'cancelled';

export interface Payment {
  id: number;
  subscription_id: number;
  asaas_payment_id: string | null;
  amount_cents: number;
  status: PaymentStatus;
  due_date: string | null;
  paid_at: Date | null;
  payment_method: string | null;
  raw_payload: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentDTO {
  subscription_id: number;
  asaas_payment_id?: string;
  amount_cents: number;
  status?: PaymentStatus;
  due_date?: string;
  paid_at?: Date;
  payment_method?: string;
  raw_payload?: any;
}

export async function createPayment(data: CreatePaymentDTO): Promise<number> {
  const result = await query<ResultSetHeader>(
    `INSERT INTO payments (subscription_id, asaas_payment_id, amount_cents,
                           status, due_date, paid_at, payment_method, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.subscription_id,
      data.asaas_payment_id || null,
      data.amount_cents,
      data.status || 'pending',
      data.due_date || null,
      data.paid_at || null,
      data.payment_method || null,
      data.raw_payload ? JSON.stringify(data.raw_payload) : null,
    ]
  );
  return result.insertId;
}

export async function upsertByAsaasId(
  asaasPaymentId: string,
  data: Omit<CreatePaymentDTO, 'asaas_payment_id'>
): Promise<number> {
  const existing = await query<Payment[]>(
    `SELECT * FROM payments WHERE asaas_payment_id = ? LIMIT 1`,
    [asaasPaymentId]
  );

  if (existing.length === 0) {
    return createPayment({ ...data, asaas_payment_id: asaasPaymentId });
  }

  const id = existing[0].id;
  await query(
    `UPDATE payments
     SET status = ?, paid_at = ?, payment_method = ?, raw_payload = ?
     WHERE id = ?`,
    [
      data.status || existing[0].status,
      data.paid_at || existing[0].paid_at,
      data.payment_method || existing[0].payment_method,
      data.raw_payload ? JSON.stringify(data.raw_payload) : existing[0].raw_payload,
      id,
    ]
  );
  return id;
}

export async function getPaymentsBySubscription(subscriptionId: number): Promise<Payment[]> {
  return query<Payment[]>(
    `SELECT * FROM payments WHERE subscription_id = ? ORDER BY id DESC`,
    [subscriptionId]
  );
}

export async function getPaymentByAsaasId(asaasPaymentId: string): Promise<Payment | null> {
  const rows = await query<Payment[]>(
    `SELECT * FROM payments WHERE asaas_payment_id = ?`,
    [asaasPaymentId]
  );
  return rows[0] || null;
}
