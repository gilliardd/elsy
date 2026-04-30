import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export interface Service {
  id: number;
  user_id: number;
  name: string;
  price_cents: number;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateServiceDTO {
  name: string;
  price_cents: number;
  duration_minutes?: number;
}

export async function createService(userId: number, data: CreateServiceDTO): Promise<number> {
  const result = await query<ResultSetHeader>(
    `INSERT INTO services (user_id, name, price_cents, duration_minutes)
     VALUES (?, ?, ?, ?)`,
    [userId, data.name.trim(), data.price_cents, data.duration_minutes || null]
  );
  return result.insertId;
}

export async function getServiceById(userId: number, id: number): Promise<Service | null> {
  const rows = await query<Service[]>(
    `SELECT * FROM services WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return rows[0] || null;
}

export async function getServiceByName(userId: number, name: string): Promise<Service | null> {
  const rows = await query<Service[]>(
    `SELECT * FROM services
     WHERE user_id = ? AND is_active = TRUE AND LOWER(name) = LOWER(?)
     LIMIT 1`,
    [userId, name.trim()]
  );
  return rows[0] || null;
}

export async function listServices(userId: number, includeInactive = false): Promise<Service[]> {
  const sql = includeInactive
    ? 'SELECT * FROM services WHERE user_id = ? ORDER BY name'
    : 'SELECT * FROM services WHERE user_id = ? AND is_active = TRUE ORDER BY name';
  return query<Service[]>(sql, [userId]);
}

export async function updateService(
  userId: number,
  id: number,
  data: Partial<CreateServiceDTO> & { is_active?: boolean }
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name.trim()); }
  if (data.price_cents !== undefined) { fields.push('price_cents = ?'); values.push(data.price_cents); }
  if (data.duration_minutes !== undefined) { fields.push('duration_minutes = ?'); values.push(data.duration_minutes); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }

  if (fields.length === 0) return;

  values.push(id, userId);
  await query(
    `UPDATE services SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );
}

export async function deleteService(userId: number, id: number): Promise<void> {
  await query(
    `UPDATE services SET is_active = FALSE WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
}
