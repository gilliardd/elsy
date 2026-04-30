import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export interface SavingsBox {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  goal_amount: number;
  current_amount: number;
  icon: string;
  color: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SavingsBoxTransaction {
  id: number;
  user_id: number;
  savings_box_id: number;
  type: 'deposit' | 'withdraw';
  amount: number;
  description: string | null;
  date: string;
  created_at: Date;
}

export async function getAllSavingsBoxes(userId: number): Promise<SavingsBox[]> {
  return query<SavingsBox[]>(
    'SELECT * FROM savings_boxes WHERE user_id = ? AND is_active = true ORDER BY name',
    [userId]
  );
}

export async function getSavingsBoxById(userId: number, id: number): Promise<SavingsBox | null> {
  const rows = await query<SavingsBox[]>(
    'SELECT * FROM savings_boxes WHERE id = ? AND user_id = ? AND is_active = true',
    [id, userId]
  );
  return rows[0] || null;
}

export async function getSavingsBoxByName(userId: number, name: string): Promise<SavingsBox | null> {
  const rows = await query<SavingsBox[]>(
    'SELECT * FROM savings_boxes WHERE user_id = ? AND UPPER(name) = UPPER(?) AND is_active = true',
    [userId, name]
  );
  return rows[0] || null;
}

export async function createSavingsBox(
  userId: number,
  data: {
    name: string;
    description?: string;
    goal_amount?: number;
    icon?: string;
    color?: string;
  }
): Promise<number> {
  const result = await query<ResultSetHeader>(
    `INSERT INTO savings_boxes (user_id, name, description, goal_amount, icon, color)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.name,
      data.description || null,
      data.goal_amount || 0,
      data.icon || 'piggy-bank',
      data.color || '#22C55E',
    ]
  );
  return result.insertId;
}

export async function updateSavingsBoxAmount(
  userId: number,
  id: number,
  amount: number
): Promise<void> {
  await query(
    'UPDATE savings_boxes SET current_amount = ? WHERE id = ? AND user_id = ?',
    [amount, id, userId]
  );
}

export async function deposit(
  userId: number,
  boxId: number,
  amount: number,
  description?: string
): Promise<void> {
  const box = await getSavingsBoxById(userId, boxId);
  if (!box) throw new Error('Caixinha nao encontrada');

  const newAmount = Number(box.current_amount) + amount;
  const today = new Date().toISOString().split('T')[0];

  await query(
    'UPDATE savings_boxes SET current_amount = ? WHERE id = ? AND user_id = ?',
    [newAmount, boxId, userId]
  );

  await query(
    `INSERT INTO savings_box_transactions (user_id, savings_box_id, type, amount, description, date)
     VALUES (?, ?, 'deposit', ?, ?, ?)`,
    [userId, boxId, amount, description || 'Deposito', today]
  );
}

export async function withdraw(
  userId: number,
  boxId: number,
  amount: number,
  description?: string
): Promise<void> {
  const box = await getSavingsBoxById(userId, boxId);
  if (!box) throw new Error('Caixinha nao encontrada');

  if (Number(box.current_amount) < amount) {
    throw new Error('Saldo insuficiente na caixinha');
  }

  const newAmount = Number(box.current_amount) - amount;
  const today = new Date().toISOString().split('T')[0];

  await query(
    'UPDATE savings_boxes SET current_amount = ? WHERE id = ? AND user_id = ?',
    [newAmount, boxId, userId]
  );

  await query(
    `INSERT INTO savings_box_transactions (user_id, savings_box_id, type, amount, description, date)
     VALUES (?, ?, 'withdraw', ?, ?, ?)`,
    [userId, boxId, amount, description || 'Retirada', today]
  );
}

export async function getBoxTransactions(
  userId: number,
  boxId: number,
  limit: number = 10
): Promise<SavingsBoxTransaction[]> {
  return query<SavingsBoxTransaction[]>(
    `SELECT * FROM savings_box_transactions
     WHERE user_id = ? AND savings_box_id = ?
     ORDER BY date DESC, created_at DESC
     LIMIT ?`,
    [userId, boxId, limit]
  );
}

export async function deleteSavingsBox(userId: number, id: number): Promise<void> {
  await query(
    'UPDATE savings_boxes SET is_active = false WHERE id = ? AND user_id = ?',
    [id, userId]
  );
}

export async function getTotalSaved(userId: number): Promise<number> {
  const result = await query<{ total: number }[]>(
    'SELECT COALESCE(SUM(current_amount), 0) as total FROM savings_boxes WHERE user_id = ? AND is_active = true',
    [userId]
  );
  return Number(result[0]?.total || 0);
}
