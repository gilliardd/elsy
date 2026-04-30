import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../src/config/database', () => ({
  query: (...args: any[]) => queryMock(...args),
}));

import { checkAccess } from '../../src/whatsapp/gate';
import type { MessagingClient, IncomingMessage } from '../../src/messaging/types';

function makeClient(): MessagingClient & { sent: { phone: string; text: string }[] } {
  const sent: { phone: string; text: string }[] = [];
  return {
    sent,
    start: vi.fn(),
    stop: vi.fn(),
    status: () => 'connected',
    connectedPhone: () => '5511000000000',
    currentQrDataUrl: () => null,
    sendText: async (phone, text) => { sent.push({ phone, text }); },
    resolvePhone: async () => null,
    onMessage: vi.fn(),
  } as any;
}

function makeMsg(phone: string): IncomingMessage {
  return {
    id: 'x',
    fromPhone: phone,
    timestamp: new Date(),
  };
}

describe('checkAccess gate', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('bloqueia numero nao cadastrado e responde com link de cadastro', async () => {
    queryMock.mockResolvedValueOnce([]); // getUserByPhone -> nenhum usuario
    const client = makeClient();
    const msg = makeMsg('5511999999991');

    const result = await checkAccess(client, msg);

    expect(result.allowed).toBe(false);
    expect(client.sent.length).toBe(1);
    expect(client.sent[0].text).toMatch(/cadastr/i);
  });

  it('bloqueia numero com plano cancelled e responde com link de billing', async () => {
    queryMock.mockResolvedValueOnce([
      {
        id: 1,
        phone_number: '5511999999992',
        phone_verified: 1,
        subscription_status: 'cancelled',
        is_active: 1,
        role: 'user',
      },
    ]);
    const client = makeClient();
    const msg = makeMsg('5511999999992');

    const result = await checkAccess(client, msg);

    expect(result.allowed).toBe(false);
    expect(client.sent[0].text).toMatch(/inativ/i);
  });

  it('libera numero com plano trialing', async () => {
    queryMock.mockResolvedValueOnce([
      {
        id: 1,
        phone_number: '5511999999993',
        phone_verified: 1,
        subscription_status: 'trialing',
        is_active: 1,
        role: 'user',
      },
    ]);
    const client = makeClient();
    const msg = makeMsg('5511999999993');

    const result = await checkAccess(client, msg);

    expect(result.allowed).toBe(true);
    expect(result.user?.id).toBe(1);
    expect(client.sent.length).toBe(0);
  });

  it('bloqueia phone_verified = false', async () => {
    queryMock.mockResolvedValueOnce([
      {
        id: 1,
        phone_number: '5511999999994',
        phone_verified: 0,
        subscription_status: 'trialing',
        is_active: 1,
        role: 'user',
      },
    ]);
    const client = makeClient();
    const msg = makeMsg('5511999999994');

    const result = await checkAccess(client, msg);

    expect(result.allowed).toBe(false);
    expect(client.sent[0].text).toMatch(/confirmar/i);
  });
});
