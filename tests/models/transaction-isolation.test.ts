import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do banco. Captura o SQL e params emitidos por cada chamada.
vi.mock('../../src/config/database', () => {
  const calls: { sql: string; params: any[] | undefined }[] = [];
  return {
    query: vi.fn(async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      // Para getTransactionById, retorna vazio para forcar behaviour de "nao achou"
      if (/SELECT \* FROM transactions WHERE id = \? AND user_id = \?/.test(sql)) {
        return [] as any;
      }
      // INSERT retorna fake insertId
      if (/INSERT INTO transactions/.test(sql)) {
        return { insertId: 1 } as any;
      }
      return [] as any;
    }),
    __getCalls: () => calls,
    __resetCalls: () => {
      calls.length = 0;
    },
  };
});

import {
  createTransaction,
  getTransactionById,
  getTransactions,
} from '../../src/models/Transaction';
import * as db from '../../src/config/database';

describe('Transaction isolation por user_id', () => {
  beforeEach(() => {
    (db as any).__resetCalls();
  });

  it('createTransaction inclui user_id no INSERT', async () => {
    await createTransaction(7, {
      type: 'expense',
      amount: 100,
      category_id: 1,
      date: '2026-04-30',
    });

    const [call] = (db as any).__getCalls();
    expect(call.sql).toContain('INSERT INTO transactions');
    expect(call.sql).toContain('user_id');
    // user_id deve ser o primeiro placeholder (apos a virgula em VALUES)
    expect(call.params[0]).toBe(7);
  });

  it('getTransactionById filtra por user_id', async () => {
    await getTransactionById(7, 100);

    const [call] = (db as any).__getCalls();
    expect(call.sql).toContain('WHERE id = ? AND user_id = ?');
    expect(call.params).toEqual([100, 7]);
  });

  it('getTransactions sempre filtra por user_id', async () => {
    await getTransactions(7, { type: 'expense' });

    const [call] = (db as any).__getCalls();
    expect(call.sql).toMatch(/WHERE user_id = \?/);
    expect(call.params?.[0]).toBe(7);
  });

  it('user A nao pode acessar transacao do user B (IDs diferentes nas params)', async () => {
    await getTransactionById(1, 99);
    await getTransactionById(2, 99);

    const calls = (db as any).__getCalls();
    expect(calls[0].params).toEqual([99, 1]);
    expect(calls[1].params).toEqual([99, 2]);
    // Mesmo id de transacao, mas user_id diferente — o WHERE garantira isolamento
  });
});
