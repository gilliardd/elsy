// HTTP client do Asaas (sandbox/producao). Configuracoes carregadas
// dinamicamente de system_config (encriptadas).

import { getConfig } from '../models/SystemConfig';

export type AsaasEnvironment = 'sandbox' | 'production';

const BASE_URLS: Record<AsaasEnvironment, string> = {
  sandbox: 'https://sandbox.asaas.com/api/v3',
  production: 'https://api.asaas.com/v3',
};

export interface AsaasConfig {
  apiKey: string;
  environment: AsaasEnvironment;
  webhookToken: string | null;
}

let cached: { value: AsaasConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getAsaasConfig(): Promise<AsaasConfig | null> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const apiKey = await getConfig('asaas_api_key');
  if (!apiKey) return null;

  const envRaw = (await getConfig('asaas_environment')) || 'sandbox';
  const environment: AsaasEnvironment = envRaw === 'production' ? 'production' : 'sandbox';
  const webhookToken = await getConfig('asaas_webhook_token');

  const value: AsaasConfig = { apiKey, environment, webhookToken };
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export function invalidateAsaasConfigCache(): void {
  cached = null;
}

class AsaasError extends Error {
  constructor(message: string, public status: number, public body: any) {
    super(message);
  }
}

async function request<T>(
  cfg: AsaasConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: any
): Promise<T> {
  const url = `${BASE_URLS[cfg.environment]}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      access_token: cfg.apiKey,
      'User-Agent': 'Elsy/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // resposta nao-JSON
  }

  if (!res.ok) {
    throw new AsaasError(
      `Asaas ${method} ${path} falhou (${res.status})`,
      res.status,
      json || text
    );
  }
  return json as T;
}

// ------------------------------------------------------------
// Customers
// ------------------------------------------------------------

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
}

export async function createCustomer(data: {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}): Promise<AsaasCustomer> {
  const cfg = await getAsaasConfig();
  if (!cfg) throw new Error('Asaas nao configurado');

  return request<AsaasCustomer>(cfg, 'POST', '/customers', {
    name: data.name,
    email: data.email,
    mobilePhone: data.phone,
    cpfCnpj: data.cpf,
  });
}

// ------------------------------------------------------------
// Subscriptions
// ------------------------------------------------------------

export interface AsaasSubscription {
  id: string;
  customer: string;
  status: string;
  value: number;
  cycle: string;
  nextDueDate: string;
}

export interface CreateSubscriptionInput {
  customerId: string;
  valueCents: number;
  nextDueDate: string;          // YYYY-MM-DD; primeira cobranca (use D+trial_days)
  description: string;
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
}

export async function createSubscription(
  input: CreateSubscriptionInput
): Promise<AsaasSubscription> {
  const cfg = await getAsaasConfig();
  if (!cfg) throw new Error('Asaas nao configurado');

  return request<AsaasSubscription>(cfg, 'POST', '/subscriptions', {
    customer: input.customerId,
    billingType: 'CREDIT_CARD',
    cycle: 'MONTHLY',
    value: input.valueCents / 100,
    nextDueDate: input.nextDueDate,
    description: input.description,
    creditCard: input.creditCard,
    creditCardHolderInfo: input.creditCardHolderInfo,
  });
}

export async function cancelSubscription(asaasSubscriptionId: string): Promise<void> {
  const cfg = await getAsaasConfig();
  if (!cfg) throw new Error('Asaas nao configurado');
  await request(cfg, 'DELETE', `/subscriptions/${asaasSubscriptionId}`);
}

// ------------------------------------------------------------
// Payments
// ------------------------------------------------------------

export interface AsaasPayment {
  id: string;
  subscription?: string;
  status: string;
  value: number;
  netValue: number;
  dueDate: string;
  paymentDate?: string;
  billingType: string;
  invoiceUrl?: string;
}

export async function listPaymentsBySubscription(
  asaasSubscriptionId: string
): Promise<AsaasPayment[]> {
  const cfg = await getAsaasConfig();
  if (!cfg) throw new Error('Asaas nao configurado');

  const result = await request<{ data: AsaasPayment[] }>(
    cfg,
    'GET',
    `/payments?subscription=${encodeURIComponent(asaasSubscriptionId)}`
  );
  return result.data || [];
}

export async function getPaymentById(asaasPaymentId: string): Promise<AsaasPayment> {
  const cfg = await getAsaasConfig();
  if (!cfg) throw new Error('Asaas nao configurado');
  return request<AsaasPayment>(cfg, 'GET', `/payments/${asaasPaymentId}`);
}

// ------------------------------------------------------------
// Verificacao do header webhook
// ------------------------------------------------------------

export async function verifyWebhookToken(headerValue: string | undefined): Promise<boolean> {
  if (!headerValue) return false;
  const cfg = await getAsaasConfig();
  if (!cfg || !cfg.webhookToken) return false;
  return headerValue === cfg.webhookToken;
}
