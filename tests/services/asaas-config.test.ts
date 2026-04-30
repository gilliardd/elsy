import { describe, it, expect, vi, beforeEach } from 'vitest';

const getConfigMock = vi.fn();

vi.mock('../../src/models/SystemConfig', () => ({
  getConfig: (...args: any[]) => getConfigMock(...args),
}));

import {
  getAsaasConfig,
  invalidateAsaasConfigCache,
  verifyWebhookToken,
} from '../../src/services/asaasService';

describe('asaas config', () => {
  beforeEach(() => {
    getConfigMock.mockReset();
    invalidateAsaasConfigCache();
  });

  it('retorna null quando api_key nao esta configurada', async () => {
    getConfigMock.mockResolvedValueOnce(null);
    const cfg = await getAsaasConfig();
    expect(cfg).toBeNull();
  });

  it('carrega config completa e respeita cache', async () => {
    getConfigMock
      .mockResolvedValueOnce('test_api_key')      // asaas_api_key
      .mockResolvedValueOnce('production')        // asaas_environment
      .mockResolvedValueOnce('webhook_secret');   // asaas_webhook_token

    const a = await getAsaasConfig();
    expect(a).toEqual({
      apiKey: 'test_api_key',
      environment: 'production',
      webhookToken: 'webhook_secret',
    });

    // 2a chamada nao deve ler do DB (cache)
    const b = await getAsaasConfig();
    expect(b).toEqual(a);
    expect(getConfigMock).toHaveBeenCalledTimes(3);
  });

  it('default environment e sandbox quando ausente', async () => {
    getConfigMock
      .mockResolvedValueOnce('k')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('w');

    const cfg = await getAsaasConfig();
    expect(cfg?.environment).toBe('sandbox');
  });

  it('verifyWebhookToken valida match exato', async () => {
    getConfigMock
      .mockResolvedValueOnce('k')
      .mockResolvedValueOnce('sandbox')
      .mockResolvedValueOnce('webhook_secret_xyz');

    expect(await verifyWebhookToken('webhook_secret_xyz')).toBe(true);

    invalidateAsaasConfigCache();
    getConfigMock
      .mockResolvedValueOnce('k')
      .mockResolvedValueOnce('sandbox')
      .mockResolvedValueOnce('webhook_secret_xyz');
    expect(await verifyWebhookToken('errado')).toBe(false);
  });

  it('verifyWebhookToken rejeita header ausente', async () => {
    expect(await verifyWebhookToken(undefined)).toBe(false);
  });
});
