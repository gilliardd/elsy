import { getPool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Asset {
  id: number;
  user_id: number;
  name: string;
  type: 'stocks' | 'fixed_income' | 'funds' | 'crypto' | 'real_estate' | 'savings' | 'other';
  institution: string | null;
  ticker: string | null;
  quantity: number | null;
  purchase_price: number | null;
  current_price: number | null;
  total_invested: number;
  current_value: number | null;
  purchase_date: string;
  maturity_date: string | null;
  expected_return: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAssetData {
  name: string;
  type: Asset['type'];
  institution?: string;
  ticker?: string;
  quantity?: number;
  purchase_price?: number;
  current_price?: number;
  total_invested: number;
  current_value?: number;
  purchase_date: string;
  maturity_date?: string;
  expected_return?: number;
  notes?: string;
}

export interface UpdateAssetData extends Partial<CreateAssetData> {
  is_active?: boolean;
}

export async function getAllAssets(userId: number): Promise<Asset[]> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM investments WHERE user_id = ? AND is_active = TRUE ORDER BY created_at DESC`,
    [userId]
  );
  return rows as Asset[];
}

export async function getAssetById(userId: number, id: number): Promise<Asset | null> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM investments WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return rows.length > 0 ? (rows[0] as Asset) : null;
}

export async function getAssetByTicker(userId: number, ticker: string): Promise<Asset | null> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM investments WHERE user_id = ? AND ticker = ? AND is_active = TRUE`,
    [userId, ticker.toUpperCase()]
  );
  return rows.length > 0 ? (rows[0] as Asset) : null;
}

export async function getAssetsByType(userId: number, type: Asset['type']): Promise<Asset[]> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM investments WHERE user_id = ? AND type = ? AND is_active = TRUE ORDER BY name`,
    [userId, type]
  );
  return rows as Asset[];
}

export async function createAsset(userId: number, data: CreateAssetData): Promise<Asset> {
  const pool = await getPool();

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO investments (
      user_id, name, type, institution, ticker, quantity, purchase_price,
      current_price, total_invested, current_value, purchase_date,
      maturity_date, expected_return, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.name,
      data.type,
      data.institution || null,
      data.ticker?.toUpperCase() || null,
      data.quantity || null,
      data.purchase_price || null,
      data.current_price || data.purchase_price || null,
      data.total_invested,
      data.current_value || data.total_invested,
      data.purchase_date,
      data.maturity_date || null,
      data.expected_return || null,
      data.notes || null,
    ]
  );

  const asset = await getAssetById(userId, result.insertId);
  return asset!;
}

export async function updateAsset(
  userId: number,
  id: number,
  data: UpdateAssetData
): Promise<Asset | null> {
  const pool = await getPool();

  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.type !== undefined) {
    fields.push('type = ?');
    values.push(data.type);
  }
  if (data.institution !== undefined) {
    fields.push('institution = ?');
    values.push(data.institution);
  }
  if (data.ticker !== undefined) {
    fields.push('ticker = ?');
    values.push(data.ticker?.toUpperCase());
  }
  if (data.quantity !== undefined) {
    fields.push('quantity = ?');
    values.push(data.quantity);
  }
  if (data.purchase_price !== undefined) {
    fields.push('purchase_price = ?');
    values.push(data.purchase_price);
  }
  if (data.current_price !== undefined) {
    fields.push('current_price = ?');
    values.push(data.current_price);
  }
  if (data.total_invested !== undefined) {
    fields.push('total_invested = ?');
    values.push(data.total_invested);
  }
  if (data.current_value !== undefined) {
    fields.push('current_value = ?');
    values.push(data.current_value);
  }
  if (data.purchase_date !== undefined) {
    fields.push('purchase_date = ?');
    values.push(data.purchase_date);
  }
  if (data.maturity_date !== undefined) {
    fields.push('maturity_date = ?');
    values.push(data.maturity_date);
  }
  if (data.expected_return !== undefined) {
    fields.push('expected_return = ?');
    values.push(data.expected_return);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    values.push(data.notes);
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(data.is_active);
  }

  if (fields.length === 0) {
    return getAssetById(userId, id);
  }

  values.push(id, userId);

  await pool.query(
    `UPDATE investments SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );

  return getAssetById(userId, id);
}

export async function deleteAsset(userId: number, id: number): Promise<boolean> {
  const pool = await getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE investments SET is_active = FALSE WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return result.affectedRows > 0;
}

export async function updateAssetPrice(
  userId: number,
  id: number,
  currentPrice: number
): Promise<Asset | null> {
  const pool = await getPool();

  const asset = await getAssetById(userId, id);
  if (!asset) return null;

  const currentValue = asset.quantity ? asset.quantity * currentPrice : currentPrice;

  await pool.query(
    `UPDATE investments SET current_price = ?, current_value = ? WHERE id = ? AND user_id = ?`,
    [currentPrice, currentValue, id, userId]
  );

  return getAssetById(userId, id);
}

export async function getTotalInvested(userId: number): Promise<number> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(total_invested), 0) as total FROM investments WHERE user_id = ? AND is_active = TRUE`,
    [userId]
  );
  return Number(rows[0].total);
}

export async function getTotalCurrentValue(userId: number): Promise<number> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(current_value), 0) as total FROM investments WHERE user_id = ? AND is_active = TRUE`,
    [userId]
  );
  return Number(rows[0].total);
}

export async function getAssetsSummaryByType(userId: number): Promise<{
  type: string;
  count: number;
  total_invested: number;
  current_value: number;
}[]> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      type,
      COUNT(*) as count,
      COALESCE(SUM(total_invested), 0) as total_invested,
      COALESCE(SUM(current_value), 0) as current_value
    FROM investments
    WHERE user_id = ? AND is_active = TRUE
    GROUP BY type
    ORDER BY total_invested DESC`,
    [userId]
  );
  return rows as { type: string; count: number; total_invested: number; current_value: number }[];
}
