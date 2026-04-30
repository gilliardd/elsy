import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export interface Transaction {
  id: number;
  user_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string | null;
  category_id: number;
  date: Date;
  notes: string | null;
  source: string;
  external_message_id: number | null;
  is_recurring: boolean;
  recurring_frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTransactionDTO {
  type: 'income' | 'expense';
  amount: number;
  description?: string;
  category_id: number;
  date: string;
  notes?: string;
  source?: string;
  external_message_id?: number;
}

export async function createTransaction(userId: number, data: CreateTransactionDTO): Promise<number> {
  const result = await query<ResultSetHeader>(
    `INSERT INTO transactions (user_id, type, amount, description, category_id, date, notes, source, external_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.type,
      data.amount,
      data.description || null,
      data.category_id,
      data.date,
      data.notes || null,
      data.source || 'manual',
      data.external_message_id || null,
    ]
  );
  return result.insertId;
}

export async function getTransactionById(userId: number, id: number): Promise<Transaction | null> {
  const rows = await query<Transaction[]>(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return rows[0] || null;
}

export async function getTransactions(
  userId: number,
  filters?: {
    type?: 'income' | 'expense';
    startDate?: string;
    endDate?: string;
    category_id?: number;
    limit?: number;
  }
): Promise<Transaction[]> {
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params: any[] = [userId];

  if (filters?.type) {
    sql += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters?.startDate) {
    sql += ' AND date >= ?';
    params.push(filters.startDate);
  }

  if (filters?.endDate) {
    sql += ' AND date <= ?';
    params.push(filters.endDate);
  }

  if (filters?.category_id) {
    sql += ' AND category_id = ?';
    params.push(filters.category_id);
  }

  sql += ' ORDER BY date DESC, created_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return query<Transaction[]>(sql, params);
}

export async function getMonthSummary(userId: number, year: number, month: number): Promise<{
  income: number;
  expense: number;
  balance: number;
}> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const incomeResult = await query<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE user_id = ? AND type = 'income' AND date BETWEEN ? AND ?`,
    [userId, startDate, endDate]
  );

  const expenseResult = await query<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?`,
    [userId, startDate, endDate]
  );

  const income = Number(incomeResult[0]?.total || 0);
  const expense = Number(expenseResult[0]?.total || 0);

  return {
    income,
    expense,
    balance: income - expense,
  };
}

export async function getRecentTransactions(
  userId: number,
  limit: number = 10
): Promise<(Transaction & { category_name: string })[]> {
  return query<(Transaction & { category_name: string })[]>(
    `SELECT t.*, c.name as category_name
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = ?
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
}

export async function getDateRangeSummary(
  userId: number,
  startDate: string,
  endDate: string
): Promise<{
  income: number;
  expense: number;
  balance: number;
}> {
  const incomeResult = await query<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE user_id = ? AND type = 'income' AND date BETWEEN ? AND ?`,
    [userId, startDate, endDate]
  );

  const expenseResult = await query<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?`,
    [userId, startDate, endDate]
  );

  const income = Number(incomeResult[0]?.total || 0);
  const expense = Number(expenseResult[0]?.total || 0);

  return {
    income,
    expense,
    balance: income - expense,
  };
}

export async function getRecentTransactionsByDateRange(
  userId: number,
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<(Transaction & { category_name: string })[]> {
  return query<(Transaction & { category_name: string })[]>(
    `SELECT t.*, c.name as category_name
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = ? AND t.date BETWEEN ? AND ?
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT ?`,
    [userId, startDate, endDate, limit]
  );
}
