import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export interface PendingAction<T = any> {
  id: number;
  user_id: number;
  type: string;
  payload: T;
  expires_at: Date;
  created_at: Date;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 min

export async function setPendingAction<T = any>(
  userId: number,
  type: string,
  payload: T,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<number> {
  // Limpa pendentes antigos do mesmo tipo para o usuario
  await query(
    `DELETE FROM pending_actions WHERE user_id = ? AND type = ?`,
    [userId, type]
  );

  const expiresAt = new Date(Date.now() + ttlMs);

  const result = await query<ResultSetHeader>(
    `INSERT INTO pending_actions (user_id, type, payload, expires_at)
     VALUES (?, ?, ?, ?)`,
    [userId, type, JSON.stringify(payload), expiresAt]
  );
  return result.insertId;
}

export async function getPendingAction<T = any>(
  userId: number,
  type: string
): Promise<PendingAction<T> | null> {
  const rows = await query<any[]>(
    `SELECT * FROM pending_actions
     WHERE user_id = ? AND type = ? AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [userId, type]
  );
  if (rows.length === 0) return null;

  return {
    ...rows[0],
    payload: rows[0].payload && typeof rows[0].payload === 'string'
      ? JSON.parse(rows[0].payload)
      : rows[0].payload,
  } as PendingAction<T>;
}

export async function clearPendingAction(userId: number, type: string): Promise<void> {
  await query(
    `DELETE FROM pending_actions WHERE user_id = ? AND type = ?`,
    [userId, type]
  );
}

// Limpeza periodica de pendentes expirados (chamada do scheduler).
export async function cleanupExpiredPendingActions(): Promise<number> {
  const result = await query<ResultSetHeader>(
    `DELETE FROM pending_actions WHERE expires_at <= NOW()`
  );
  return result.affectedRows;
}
