import axios from 'axios';

const businessApi = axios.create({
  baseURL: '/api/business',
  headers: { 'Content-Type': 'application/json' },
});

businessApi.interceptors.request.use((config) => {
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

export interface Customer {
  id: number;
  user_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  notes: string | null;
  total_billed_cents: number;
  total_paid_cents: number;
  last_visit_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: number;
  user_id: number;
  name: string;
  price_cents: number;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Receivable {
  id: number;
  user_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  service_id: number | null;
  amount_cents: number;
  description: string | null;
  due_date: string;
  status: 'pending' | 'paid';
  paid_at: string | null;
  payment_method: string | null;
  created_at: string;
}

export interface CashSummary {
  inCents: number;
  outCents: number;
  balanceCents: number;
  countIn: number;
  countOut: number;
}

export interface CashMovement {
  id: number;
  type: 'in' | 'out';
  amount_cents: number;
  description: string | null;
  receivable_id: number | null;
  date: string;
  created_at: string;
}

export interface BusinessDashboard {
  today: { cash: CashSummary; date: string };
  yesterday: { cash: CashSummary; date: string };
  month: { cash: CashSummary; fromDate: string; toDate: string };
  prevMonth: { revenueCents: number; fromDate: string; toDate: string };
  pending: { totalCents: number; upcoming: Receivable[] };
  topCustomers: { customer_id: number; name: string; total_cents: number }[];
}

// ------------------------------------------------------------
// Endpoints
// ------------------------------------------------------------

export async function getDashboard(): Promise<BusinessDashboard> {
  const r = await businessApi.get('/dashboard');
  return r.data.data;
}

export async function listCustomers(params: { search?: string; limit?: number; offset?: number } = {}) {
  const r = await businessApi.get<{ data: { customers: Customer[]; total: number } }>('/customers', { params });
  return r.data.data;
}

export async function getCustomer(id: number) {
  const r = await businessApi.get(`/customers/${id}`);
  return r.data.data as { customer: Customer; receivables: Receivable[] };
}

export async function createCustomer(data: Partial<Customer>) {
  const r = await businessApi.post('/customers', data);
  return r.data.data as Customer;
}

export async function updateCustomer(id: number, data: Partial<Customer>) {
  const r = await businessApi.put(`/customers/${id}`, data);
  return r.data.data as Customer;
}

export async function deleteCustomer(id: number) {
  await businessApi.delete(`/customers/${id}`);
}

export async function listServices(includeInactive = false) {
  const r = await businessApi.get('/services', { params: { includeInactive } });
  return r.data.data as Service[];
}

export async function createService(data: Partial<Service>) {
  const r = await businessApi.post('/services', data);
  return r.data.data as Service;
}

export async function updateService(id: number, data: Partial<Service>) {
  const r = await businessApi.put(`/services/${id}`, data);
  return r.data.data as Service;
}

export async function deleteService(id: number) {
  await businessApi.delete(`/services/${id}`);
}

export async function listReceivables(params: {
  status?: 'pending' | 'paid';
  customerId?: number;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const r = await businessApi.get('/receivables', { params });
  return r.data.data as { items: Receivable[]; total: number };
}

export async function createReceivable(data: {
  customer_id: number;
  service_id?: number;
  amount_cents: number;
  description?: string;
  due_date: string;
}) {
  const r = await businessApi.post('/receivables', data);
  return r.data.data as Receivable;
}

export async function payReceivable(id: number, payment_method?: string) {
  const r = await businessApi.post(`/receivables/${id}/pay`, { payment_method });
  return r.data.data as Receivable;
}

export async function deleteReceivable(id: number) {
  await businessApi.delete(`/receivables/${id}`);
}

export async function getCash(fromDate?: string, toDate?: string) {
  const r = await businessApi.get('/cash', { params: { fromDate, toDate } });
  return r.data.data as { summary: CashSummary; movements: CashMovement[]; fromDate: string; toDate: string };
}

export async function createCashMovement(data: {
  type: 'in' | 'out';
  amount_cents: number;
  description?: string;
  date?: string;
}) {
  const r = await businessApi.post('/cash', data);
  return r.data.data;
}
