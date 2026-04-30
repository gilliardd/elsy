import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do modulo de banco para nao exigir MySQL nos testes unitarios.
// Captura o SQL emitido por cloneTemplateCategoriesToUser para garantir
// que ele realmente filtra user_id IS NULL e copia para o user_id passado.
vi.mock('../../src/config/database', () => {
  const calls: { sql: string; params: any[] | undefined }[] = [];
  return {
    query: vi.fn(async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      return [] as any;
    }),
    __getCalls: () => calls,
    __resetCalls: () => {
      calls.length = 0;
    },
  };
});

import { cloneTemplateCategoriesToUser } from '../../src/models/Category';
import * as db from '../../src/config/database';

describe('cloneTemplateCategoriesToUser', () => {
  beforeEach(() => {
    (db as any).__resetCalls();
  });

  it('copia apenas linhas template (user_id IS NULL) para o novo usuario', async () => {
    await cloneTemplateCategoriesToUser(99);

    const calls = (db as any).__getCalls();
    expect(calls.length).toBe(1);

    const { sql, params } = calls[0];
    expect(sql).toContain('INSERT INTO categories');
    expect(sql).toContain('user_id IS NULL');
    expect(sql).toContain('is_active = true');
    expect(params).toEqual([99]);
  });
});
