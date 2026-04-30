import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database', () => {
  const calls: { sql: string; params: any[] | undefined }[] = [];
  return {
    query: vi.fn(async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM pending_actions/.test(sql)) return [];
      if (/INSERT INTO pending_actions/.test(sql)) return { insertId: 7 } as any;
      return { affectedRows: 0 } as any;
    }),
    __getCalls: () => calls,
    __resetCalls: () => { calls.length = 0; },
  };
});

import {
  setPendingAction,
  getPendingAction,
  clearPendingAction,
} from '../../src/models/PendingAction';
import * as db from '../../src/config/database';

describe('pending_actions', () => {
  beforeEach(() => {
    (db as any).__resetCalls();
  });

  it('setPendingAction limpa pendentes anteriores e insere novo', async () => {
    await setPendingAction(5, 'transaction_confirm', { x: 1 });

    const calls = (db as any).__getCalls();
    expect(calls.length).toBe(2);

    expect(calls[0].sql).toContain('DELETE FROM pending_actions');
    expect(calls[0].params).toEqual([5, 'transaction_confirm']);

    expect(calls[1].sql).toContain('INSERT INTO pending_actions');
    // user_id, type, payload(JSON), expires_at
    expect(calls[1].params?.[0]).toBe(5);
    expect(calls[1].params?.[1]).toBe('transaction_confirm');
    expect(JSON.parse(calls[1].params?.[2])).toEqual({ x: 1 });
    expect(calls[1].params?.[3]).toBeInstanceOf(Date);
  });

  it('getPendingAction filtra por user_id, type e expires_at > NOW', async () => {
    await getPendingAction(5, 'transaction_confirm');
    const [call] = (db as any).__getCalls();
    expect(call.sql).toContain('user_id = ?');
    expect(call.sql).toContain('type = ?');
    expect(call.sql).toContain('expires_at > NOW()');
    expect(call.params).toEqual([5, 'transaction_confirm']);
  });

  it('clearPendingAction remove apenas a do par (user_id, type)', async () => {
    await clearPendingAction(5, 'transaction_confirm');
    const [call] = (db as any).__getCalls();
    expect(call.sql).toContain('DELETE FROM pending_actions');
    expect(call.params).toEqual([5, 'transaction_confirm']);
  });
});
