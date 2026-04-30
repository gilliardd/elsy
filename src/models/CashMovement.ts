import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export type CashMovementType = 'in' | 'out';

export interface CashMovement {
  id: number;
  user_id: number;
  type: CashMovementType;
  amount_cents: number;
  description: string | null;
  receivable_id: number | null;
  transaction_id: number | null;
  category_id: number | null;
  date: string;
  created_at: Date;
}

export interface CreateCashMovementDTO {
  type: CashMovementType;
  amount_cents: number;
  description?: string;
  receivable_id?: number;
  transaction_id?: number;
  category_id?: number;
  date?: string; // default = hoje
}

export async function createCashMovement(
  userId: number,
  data: CreateCashMovementDTO
): Promise<number> {
  const date = data.date || new Date().toISOString().split('T')[0];
  const result = await query<ResultSetHeader>(
    `INSERT INTO cash_movements
     (user_id, type, amount_cents, description, receivable_id, transaction_id, category_id, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.type,
      data.amount_cents,
      data.description || null,
      data.receivable_id || null,
      data.transaction_id || null,
      data.category_id || null,
      date,
    ]
  );
  return result.insertId;
}

export interface CashSummary {
  inCents: number;
  outCents: number;
  balanceCents: number;
  countIn: number;
  countOut: number;
}

export async function getCashSummary(
  userId: number,
  fromDate: string,
  toDate: string
): Promise<CashSummary> {
  const rows = await query<{ type: CashMovementType; total: number; cnt: number }[]>(
    `SELECT type,
            COALESCE(SUM(amount_cents), 0) AS total,
            COUNT(*) AS cnt
     FROM cash_movements
     WHERE user_id = ? AND date BETWEEN ? AND ?
     GROUP BY type`,
    [userId, fromDate, toDate]
  );

  const inRow = rows.find((r) => r.type === 'in');
  const outRow = rows.find((r) => r.type === 'out');
  const inCents = Number(inRow?.total || 0);
  const outCents = Number(outRow?.total || 0);

  return {
    inCents,
    outCents,
    balanceCents: inCents - outCents,
    countIn: Number(inRow?.cnt || 0),
    countOut: Number(outRow?.cnt || 0),
  };
}

export async function listCashMovements(
  userId: number,
  fromDate: string,
  toDate: string,
  limit = 200
): Promise<CashMovement[]> {
  return query<CashMovement[]>(
    `SELECT * FROM cash_movements
     WHERE user_id = ? AND date BETWEEN ? AND ?
     ORDER BY date DESC, id DESC
     LIMIT ?`,
    [userId, fromDate, toDate, limit]
  );
}

// Faturamento: soma das entradas (in) por periodo
export async function getRevenueCents(
  userId: number,
  fromDate: string,
  toDate: string
): Promise<number> {
  const rows = await query<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
     FROM cash_movements
     WHERE user_id = ? AND type = 'in' AND date BETWEEN ? AND ?`,
    [userId, fromDate, toDate]
  );
  return Number(rows[0]?.total || 0);
}
