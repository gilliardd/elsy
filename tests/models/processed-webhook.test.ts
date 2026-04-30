import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../src/config/database', () => ({
  query: (...args: any[]) => queryMock(...args),
}));

import { markProcessed } from '../../src/models/ProcessedWebhook';

describe('markProcessed (idempotencia de webhook)', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('retorna true em primeira marcacao', async () => {
    queryMock.mockResolvedValueOnce({ insertId: 1 });
    const ok = await markProcessed('PAYMENT_RECEIVED:abc', 'asaas');
    expect(ok).toBe(true);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO processed_webhooks'),
      ['PAYMENT_RECEIVED:abc', 'asaas']
    );
  });

  it('retorna false em duplicata (ER_DUP_ENTRY)', async () => {
    const dupErr: any = new Error('Duplicate');
    dupErr.code = 'ER_DUP_ENTRY';
    queryMock.mockRejectedValueOnce(dupErr);

    const ok = await markProcessed('PAYMENT_RECEIVED:abc', 'asaas');
    expect(ok).toBe(false);
  });

  it('propaga erros nao relacionados a duplicata', async () => {
    queryMock.mockRejectedValueOnce(new Error('Connection lost'));
    await expect(markProcessed('x', 'asaas')).rejects.toThrow('Connection lost');
  });
});
