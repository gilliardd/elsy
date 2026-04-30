import { query } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export type MessageDirection = 'in' | 'out';

export interface MessageLog {
  id: number;
  user_id: number | null;
  channel: string;
  direction: MessageDirection;
  phone: string | null;
  content: string | null;
  status: string | null;
  error: string | null;
  metadata: any;
  created_at: Date;
}

export interface CreateMessageLogDTO {
  user_id?: number | null;
  channel: string;
  direction: MessageDirection;
  phone?: string;
  content?: string;
  status?: string;
  error?: string;
  metadata?: any;
}

export async function logMessage(data: CreateMessageLogDTO): Promise<number> {
  const result = await query<ResultSetHeader>(
    `INSERT INTO message_logs (user_id, channel, direction, phone, content, status, error, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id ?? null,
      data.channel,
      data.direction,
      data.phone || null,
      data.content || null,
      data.status || null,
      data.error || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );
  return result.insertId;
}

export async function getMessagesByUser(userId: number, limit = 50): Promise<MessageLog[]> {
  return query<MessageLog[]>(
    `SELECT * FROM message_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
    [userId, limit]
  );
}

export async function getMessagesByPhone(phone: string, limit = 50): Promise<MessageLog[]> {
  return query<MessageLog[]>(
    `SELECT * FROM message_logs WHERE phone = ? ORDER BY id DESC LIMIT ?`,
    [phone, limit]
  );
}
