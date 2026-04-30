import { getPool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface AssetMovement {
  id: number;
  user_id: number;
  asset_id: number;
  date: string;
  movement_type: 'entry' | 'exit' | 'dividend';
  quantity: number;
  price: number;
  total: number;
  fee_rate: number;
  total_after_fee: number;
  current_price: number | null;
  profit: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  asset_name?: string;
  asset_type?: string;
  asset_ticker?: string;
}

export interface CreateMovementData {
  asset_id: number;
  date: string;
  movement_type: 'entry' | 'exit' | 'dividend';
  quantity: number;
  price: number;
  fee_rate?: number;
  current_price?: number;
  notes?: string;
}

export interface UpdateMovementData extends Partial<CreateMovementData> {}

export async function getAllMovements(userId: number): Promise<AssetMovement[]> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      m.*,
      i.name as asset_name,
      i.type as asset_type,
      i.ticker as asset_ticker
    FROM asset_movements m
    JOIN investments i ON m.asset_id = i.id
    WHERE m.user_id = ?
    ORDER BY m.date DESC, m.created_at DESC`,
    [userId]
  );
  return rows as AssetMovement[];
}

export async function getMovementById(userId: number, id: number): Promise<AssetMovement | null> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      m.*,
      i.name as asset_name,
      i.type as asset_type,
      i.ticker as asset_ticker
    FROM asset_movements m
    JOIN investments i ON m.asset_id = i.id
    WHERE m.id = ? AND m.user_id = ?`,
    [id, userId]
  );
  return rows.length > 0 ? (rows[0] as AssetMovement) : null;
}

export async function getMovementsByAsset(userId: number, assetId: number): Promise<AssetMovement[]> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      m.*,
      i.name as asset_name,
      i.type as asset_type,
      i.ticker as asset_ticker
    FROM asset_movements m
    JOIN investments i ON m.asset_id = i.id
    WHERE m.user_id = ? AND m.asset_id = ?
    ORDER BY m.date DESC`,
    [userId, assetId]
  );
  return rows as AssetMovement[];
}

export async function getMovementsByDateRange(
  userId: number,
  startDate: string,
  endDate: string
): Promise<AssetMovement[]> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
      m.*,
      i.name as asset_name,
      i.type as asset_type,
      i.ticker as asset_ticker
    FROM asset_movements m
    JOIN investments i ON m.asset_id = i.id
    WHERE m.user_id = ? AND m.date BETWEEN ? AND ?
    ORDER BY m.date DESC`,
    [userId, startDate, endDate]
  );
  return rows as AssetMovement[];
}

export async function createMovement(
  userId: number,
  data: CreateMovementData
): Promise<AssetMovement> {
  const pool = await getPool();

  const total = data.quantity * data.price;
  const feeRate = data.fee_rate || 0;
  const feeAmount = total * (feeRate / 100);

  let totalAfterFee: number;
  if (data.movement_type === 'entry') {
    totalAfterFee = total + feeAmount;
  } else if (data.movement_type === 'exit') {
    totalAfterFee = total - feeAmount;
  } else {
    totalAfterFee = total - feeAmount;
  }

  let profit: number | null = null;
  if (data.movement_type === 'dividend') {
    profit = totalAfterFee;
  } else if (data.current_price !== undefined && data.current_price !== null) {
    const currentTotal = data.quantity * data.current_price;
    profit = data.movement_type === 'entry'
      ? currentTotal - totalAfterFee
      : totalAfterFee - currentTotal;
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO asset_movements (
      user_id, asset_id, date, movement_type, quantity, price, total,
      fee_rate, total_after_fee, current_price, profit, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.asset_id,
      data.date,
      data.movement_type,
      data.quantity,
      data.price,
      total,
      feeRate,
      totalAfterFee,
      data.current_price || null,
      profit,
      data.notes || null,
    ]
  );

  const movement = await getMovementById(userId, result.insertId);
  return movement!;
}

export async function updateMovement(
  userId: number,
  id: number,
  data: UpdateMovementData
): Promise<AssetMovement | null> {
  const pool = await getPool();

  const existing = await getMovementById(userId, id);
  if (!existing) return null;

  const quantity = data.quantity ?? existing.quantity;
  const price = data.price ?? existing.price;
  const movementType = data.movement_type ?? existing.movement_type;
  const feeRate = data.fee_rate ?? existing.fee_rate;
  const currentPrice = data.current_price ?? existing.current_price;

  const total = quantity * price;
  const feeAmount = total * (feeRate / 100);

  let totalAfterFee: number;
  if (movementType === 'entry') {
    totalAfterFee = total + feeAmount;
  } else if (movementType === 'exit') {
    totalAfterFee = total - feeAmount;
  } else {
    totalAfterFee = total - feeAmount;
  }

  let profit: number | null = null;
  if (movementType === 'dividend') {
    profit = totalAfterFee;
  } else if (currentPrice !== null) {
    const currentTotal = quantity * currentPrice;
    profit = movementType === 'entry'
      ? currentTotal - totalAfterFee
      : totalAfterFee - currentTotal;
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (data.asset_id !== undefined) {
    fields.push('asset_id = ?');
    values.push(data.asset_id);
  }
  if (data.date !== undefined) {
    fields.push('date = ?');
    values.push(data.date);
  }
  if (data.movement_type !== undefined) {
    fields.push('movement_type = ?');
    values.push(data.movement_type);
  }
  if (data.quantity !== undefined || data.price !== undefined) {
    fields.push('quantity = ?', 'price = ?', 'total = ?');
    values.push(quantity, price, total);
  }
  if (data.fee_rate !== undefined || data.quantity !== undefined || data.price !== undefined) {
    fields.push('fee_rate = ?', 'total_after_fee = ?');
    values.push(feeRate, totalAfterFee);
  }
  if (data.current_price !== undefined) {
    fields.push('current_price = ?', 'profit = ?');
    values.push(currentPrice, profit);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    values.push(data.notes);
  }

  if (fields.length === 0) {
    return existing;
  }

  values.push(id, userId);

  await pool.query(
    `UPDATE asset_movements SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );

  return getMovementById(userId, id);
}

export async function deleteMovement(userId: number, id: number): Promise<boolean> {
  const pool = await getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM asset_movements WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return result.affectedRows > 0;
}

export async function updateAllCurrentPrices(
  userId: number,
  assetId: number,
  currentPrice: number
): Promise<void> {
  const pool = await getPool();

  await pool.query(
    `UPDATE asset_movements
    SET
      current_price = CASE WHEN movement_type = 'dividend' THEN current_price ELSE ? END,
      profit = CASE
        WHEN movement_type = 'dividend' THEN total_after_fee
        WHEN movement_type = 'entry' THEN (quantity * ?) - total_after_fee
        ELSE total_after_fee - (quantity * ?)
      END
    WHERE user_id = ? AND asset_id = ?`,
    [currentPrice, currentPrice, currentPrice, userId, assetId]
  );
}

export async function getMovementsSummary(
  userId: number,
  startDate?: string,
  endDate?: string
): Promise<{
  totalEntries: number;
  totalExits: number;
  totalDividends: number;
  totalInvested: number;
  totalProfit: number;
}> {
  const pool = await getPool();

  let sql = `
    SELECT
      SUM(CASE WHEN movement_type = 'entry' THEN total_after_fee ELSE 0 END) as totalEntries,
      SUM(CASE WHEN movement_type = 'exit' THEN total_after_fee ELSE 0 END) as totalExits,
      SUM(CASE WHEN movement_type = 'dividend' THEN total_after_fee ELSE 0 END) as totalDividends,
      SUM(CASE WHEN movement_type = 'entry' THEN total_after_fee WHEN movement_type = 'exit' THEN -total_after_fee ELSE 0 END) as totalInvested,
      COALESCE(SUM(profit), 0) as totalProfit
    FROM asset_movements
    WHERE user_id = ?
  `;

  const params: any[] = [userId];
  if (startDate && endDate) {
    sql += ` AND date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);

  return {
    totalEntries: Number(rows[0].totalEntries) || 0,
    totalExits: Number(rows[0].totalExits) || 0,
    totalDividends: Number(rows[0].totalDividends) || 0,
    totalInvested: Number(rows[0].totalInvested) || 0,
    totalProfit: Number(rows[0].totalProfit) || 0,
  };
}

export async function getProfitByMonth(
  userId: number,
  startDate?: string,
  endDate?: string
): Promise<{
  month: string;
  entries: number;
  exits: number;
  dividends: number;
  profit: number;
}[]> {
  const pool = await getPool();

  let sql = `
    SELECT
      DATE_FORMAT(date, '%Y-%m') as month,
      SUM(CASE WHEN movement_type = 'entry' THEN total_after_fee ELSE 0 END) as entries,
      SUM(CASE WHEN movement_type = 'exit' THEN total_after_fee ELSE 0 END) as exits,
      SUM(CASE WHEN movement_type = 'dividend' THEN total_after_fee ELSE 0 END) as dividends,
      COALESCE(SUM(profit), 0) as profit
    FROM asset_movements
    WHERE user_id = ?
  `;

  const params: any[] = [userId];
  if (startDate && endDate) {
    sql += ` AND date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  sql += ` GROUP BY DATE_FORMAT(date, '%Y-%m') ORDER BY month`;

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);

  return rows.map(row => ({
    month: row.month,
    entries: Number(row.entries) || 0,
    exits: Number(row.exits) || 0,
    dividends: Number(row.dividends) || 0,
    profit: Number(row.profit) || 0,
  }));
}

export async function getProfitByType(
  userId: number,
  startDate?: string,
  endDate?: string
): Promise<{
  type: string;
  entries: number;
  exits: number;
  dividends: number;
  profit: number;
  count: number;
}[]> {
  const pool = await getPool();

  let sql = `
    SELECT
      i.type,
      SUM(CASE WHEN m.movement_type = 'entry' THEN m.total_after_fee ELSE 0 END) as entries,
      SUM(CASE WHEN m.movement_type = 'exit' THEN m.total_after_fee ELSE 0 END) as exits,
      SUM(CASE WHEN m.movement_type = 'dividend' THEN m.total_after_fee ELSE 0 END) as dividends,
      COALESCE(SUM(m.profit), 0) as profit,
      COUNT(*) as count
    FROM asset_movements m
    JOIN investments i ON m.asset_id = i.id
    WHERE m.user_id = ?
  `;

  const params: any[] = [userId];
  if (startDate && endDate) {
    sql += ` AND m.date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  sql += ` GROUP BY i.type ORDER BY entries DESC`;

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);

  return rows.map(row => ({
    type: row.type,
    entries: Number(row.entries) || 0,
    exits: Number(row.exits) || 0,
    dividends: Number(row.dividends) || 0,
    profit: Number(row.profit) || 0,
    count: Number(row.count) || 0,
  }));
}

export async function getProfitByAsset(
  userId: number,
  startDate?: string,
  endDate?: string
): Promise<{
  asset_id: number;
  asset_name: string;
  asset_ticker: string | null;
  asset_type: string;
  entries: number;
  exits: number;
  dividends: number;
  profit: number;
  quantity: number;
}[]> {
  const pool = await getPool();

  let sql = `
    SELECT
      i.id as asset_id,
      i.name as asset_name,
      i.ticker as asset_ticker,
      i.type as asset_type,
      SUM(CASE WHEN m.movement_type = 'entry' THEN m.total_after_fee ELSE 0 END) as entries,
      SUM(CASE WHEN m.movement_type = 'exit' THEN m.total_after_fee ELSE 0 END) as exits,
      SUM(CASE WHEN m.movement_type = 'dividend' THEN m.total_after_fee ELSE 0 END) as dividends,
      COALESCE(SUM(m.profit), 0) as profit,
      SUM(CASE WHEN m.movement_type = 'entry' THEN m.quantity WHEN m.movement_type = 'exit' THEN -m.quantity ELSE 0 END) as quantity
    FROM asset_movements m
    JOIN investments i ON m.asset_id = i.id
    WHERE m.user_id = ?
  `;

  const params: any[] = [userId];
  if (startDate && endDate) {
    sql += ` AND m.date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  sql += ` GROUP BY i.id, i.name, i.ticker, i.type ORDER BY entries DESC`;

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);

  return rows.map(row => ({
    asset_id: row.asset_id,
    asset_name: row.asset_name,
    asset_ticker: row.asset_ticker,
    asset_type: row.asset_type,
    entries: Number(row.entries) || 0,
    exits: Number(row.exits) || 0,
    dividends: Number(row.dividends) || 0,
    profit: Number(row.profit) || 0,
    quantity: Number(row.quantity) || 0,
  }));
}

export async function getPurchasesByAsset(
  userId: number,
  startDate?: string,
  endDate?: string
): Promise<{
  asset_id: number;
  asset_name: string;
  asset_ticker: string | null;
  asset_type: string;
  total_purchased: number;
  quantity_purchased: number;
  avg_price: number;
}[]> {
  const pool = await getPool();

  let sql = `
    SELECT
      i.id as asset_id,
      i.name as asset_name,
      i.ticker as asset_ticker,
      i.type as asset_type,
      SUM(m.total_after_fee) as total_purchased,
      SUM(m.quantity) as quantity_purchased,
      AVG(m.price) as avg_price
    FROM asset_movements m
    JOIN investments i ON m.asset_id = i.id
    WHERE m.user_id = ? AND m.movement_type = 'entry'
  `;

  const params: any[] = [userId];
  if (startDate && endDate) {
    sql += ` AND m.date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  sql += ` GROUP BY i.id, i.name, i.ticker, i.type ORDER BY total_purchased DESC`;

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);

  return rows.map(row => ({
    asset_id: row.asset_id,
    asset_name: row.asset_name,
    asset_ticker: row.asset_ticker,
    asset_type: row.asset_type,
    total_purchased: Number(row.total_purchased) || 0,
    quantity_purchased: Number(row.quantity_purchased) || 0,
    avg_price: Number(row.avg_price) || 0,
  }));
}

export async function getPurchasesByCategory(
  userId: number,
  startDate?: string,
  endDate?: string
): Promise<{
  type: string;
  total_purchased: number;
  quantity_purchased: number;
  asset_count: number;
}[]> {
  const pool = await getPool();

  let sql = `
    SELECT
      i.type,
      SUM(m.total_after_fee) as total_purchased,
      SUM(m.quantity) as quantity_purchased,
      COUNT(DISTINCT i.id) as asset_count
    FROM asset_movements m
    JOIN investments i ON m.asset_id = i.id
    WHERE m.user_id = ? AND m.movement_type = 'entry'
  `;

  const params: any[] = [userId];
  if (startDate && endDate) {
    sql += ` AND m.date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  sql += ` GROUP BY i.type ORDER BY total_purchased DESC`;

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);

  return rows.map(row => ({
    type: row.type,
    total_purchased: Number(row.total_purchased) || 0,
    quantity_purchased: Number(row.quantity_purchased) || 0,
    asset_count: Number(row.asset_count) || 0,
  }));
}
