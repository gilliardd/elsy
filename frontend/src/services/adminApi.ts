// Cliente HTTP para endpoints /api/admin/*. Reutiliza o axios do api.ts
// (que ja injeta Authorization Bearer via interceptor).
import axios from 'axios';

const adminApi = axios.create({
  baseURL: '/api/admin',
  headers: { 'Content-Type': 'application/json' },
});

// Injeta o token armazenado em localStorage
adminApi.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('elsy_auth');
    if (stored) {
      const { token } = JSON.parse(stored);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignora
  }
  return config;
});

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

export interface AdminUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  cpf: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  role: 'admin' | 'user' | 'viewer';
  subscription_status: string | null;
  subscription_expires_at: string | null;
  current_subscription_id: number | null;
  asaas_customer_id: string | null;
  trial_used: boolean;
  cortesia_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  trial_days: number;
  asaas_billing_type: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan_id: number;
  asaas_subscription_id: string | null;
  status: string;
  started_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  subscription_id: number;
  asaas_payment_id: string | null;
  amount_cents: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  created_at: string;
}

export interface MessageLog {
  id: number;
  user_id: number | null;
  user_name?: string;
  channel: string;
  direction: 'in' | 'out';
  phone: string | null;
  content: string | null;
  status: string | null;
  error: string | null;
  created_at: string;
}

export interface SystemConfigItem {
  key: string;
  value: string;
  is_secret: boolean;
  description: string | null;
}

export interface Metrics {
  users: {
    total: number;
    admin: number;
    trialing: number;
    active: number;
    overdue: number;
    blocked: number;
    cortesia: number;
    cancelled: number;
    incomplete: number;
    none: number;
  };
  mrrCents: number;
  signupsLast30d: number;
  churnLast30d: number;
}

// ------------------------------------------------------------
// Endpoints
// ------------------------------------------------------------

export async function getMetrics(): Promise<Metrics> {
  const r = await adminApi.get('/metrics');
  return r.data.data;
}

// Users
export async function listUsers(params: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
} = {}): Promise<{ users: AdminUser[]; total: number; limit: number; offset: number }> {
  const r = await adminApi.get('/users', { params });
  return r.data.data;
}

export async function getUserDetail(id: number): Promise<{
  user: AdminUser;
  activeSubscription: Subscription | null;
  subscriptions: Subscription[];
  payments: Payment[];
}> {
  const r = await adminApi.get(`/users/${id}`);
  return r.data.data;
}

export async function getUserMessages(id: number, limit = 100): Promise<MessageLog[]> {
  const r = await adminApi.get(`/users/${id}/messages`, { params: { limit } });
  return r.data.data;
}

export async function grantCortesia(id: number, expiresAt: string): Promise<void> {
  await adminApi.post(`/users/${id}/cortesia`, { expiresAt });
}

export async function extendTrial(id: number, days: number): Promise<void> {
  await adminApi.post(`/users/${id}/extend-trial`, { days });
}

export async function blockUser(id: number): Promise<void> {
  await adminApi.post(`/users/${id}/block`);
}

export async function unblockUser(id: number, newStatus = 'active'): Promise<void> {
  await adminApi.post(`/users/${id}/unblock`, { newStatus });
}

// Plans
export async function listPlans(includeInactive = true): Promise<Plan[]> {
  const r = await adminApi.get('/plans', { params: { includeInactive } });
  return r.data.data;
}

export async function createPlan(data: Partial<Plan>): Promise<Plan> {
  const r = await adminApi.post('/plans', data);
  return r.data.data;
}

export async function updatePlan(id: number, data: Partial<Plan>): Promise<Plan> {
  const r = await adminApi.put(`/plans/${id}`, data);
  return r.data.data;
}

export async function deletePlan(id: number): Promise<void> {
  await adminApi.delete(`/plans/${id}`);
}

// Payments
export async function listPayments(params: {
  limit?: number;
  offset?: number;
  status?: string;
} = {}): Promise<{ payments: any[]; total: number; limit: number; offset: number }> {
  const r = await adminApi.get('/payments', { params });
  return r.data.data;
}

// Messages
export async function listMessages(params: {
  limit?: number;
  offset?: number;
  direction?: 'in' | 'out';
  phone?: string;
  userId?: number;
} = {}): Promise<{ messages: MessageLog[]; total: number; limit: number; offset: number }> {
  const r = await adminApi.get('/messages', { params });
  return r.data.data;
}

// System config
export async function getSystemConfig(): Promise<SystemConfigItem[]> {
  const r = await adminApi.get('/system-config');
  return r.data.data;
}

export async function setSystemConfig(
  key: string,
  value: string,
  isSecret: boolean,
  description?: string
): Promise<void> {
  await adminApi.put(`/system-config/${encodeURIComponent(key)}`, { value, isSecret, description });
}

export async function deleteSystemConfig(key: string): Promise<void> {
  await adminApi.delete(`/system-config/${encodeURIComponent(key)}`);
}

// WhatsApp
export async function getWhatsAppStatus(): Promise<{
  status: 'disconnected' | 'connecting' | 'qr_required' | 'connected';
  connectedPhone: string | null;
  qrAvailable: boolean;
}> {
  const r = await adminApi.get('/whatsapp/status');
  return r.data.data;
}

export async function getWhatsAppQr(): Promise<string | null> {
  try {
    const r = await adminApi.get('/whatsapp/qr');
    return r.data.data.qr;
  } catch {
    return null;
  }
}

export async function reconnectWhatsApp(): Promise<void> {
  await adminApi.post('/whatsapp/reconnect');
}
