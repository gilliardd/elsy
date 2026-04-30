import { query } from '../config/database';

// Idempotencia para webhooks. Antes de processar um evento, chame
// markProcessed(eventId, source). Se retornar false, o evento ja foi
// processado — pule.

export async function markProcessed(eventId: string, source: string): Promise<boolean> {
  try {
    await query(
      `INSERT INTO processed_webhooks (event_id, source) VALUES (?, ?)`,
      [eventId, source]
    );
    return true;
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return false;
    throw err;
  }
}
