import { useEffect, useState } from 'react';
import BusinessLayout from '../../components/business/BusinessLayout';
import {
  listReceivables,
  payReceivable,
  createReceivable,
  listCustomers,
  type Receivable,
  type Customer,
} from '../../services/businessApi';

function brl(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export default function BusinessReceivables() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [status, setStatus] = useState<'pending' | 'paid' | ''>('pending');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_id: '', amount: '', description: '', due_date: '' });

  async function load() {
    setLoading(true);
    try {
      const r = await listReceivables({ status: status || undefined, limit: 200 });
      setItems(r.items);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    const r = await listCustomers({ limit: 500 });
    setCustomers(r.customers);
  }

  useEffect(() => {
    load();
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id || !form.amount || !form.due_date) return;
    const cents = Math.round(parseFloat(form.amount.replace(',', '.')) * 100);
    try {
      await createReceivable({
        customer_id: Number(form.customer_id),
        amount_cents: cents,
        description: form.description || undefined,
        due_date: form.due_date,
      });
      setForm({ customer_id: '', amount: '', description: '', due_date: '' });
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar');
    }
  }

  async function handlePay(id: number) {
    if (!confirm('Marcar como recebido?')) return;
    await payReceivable(id);
    await load();
  }

  const totalOpen = items.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount_cents, 0);

  return (
    <BusinessLayout title="Recebiveis">
      <div className="flex gap-2 mb-4 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="paid">Pagos</option>
        </select>
        <span className="text-sm text-gray-600">
          {items.length} item(ns)
          {status === 'pending' && ` · em aberto: ${brl(totalOpen)}`}
        </span>
        <div className="flex-1" />
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          {showForm ? 'Cancelar' : 'Novo recebivel'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            value={form.customer_id} required
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Cliente *</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="text" placeholder="Valor *" required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="text" placeholder="Descricao"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="date" required
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">
            Salvar
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr className="text-left">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Descricao</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Carregando...</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Sem recebiveis.</td></tr>
            )}
            {items.map((r) => {
              const today = new Date().toISOString().split('T')[0];
              const overdue = r.status === 'pending' && r.due_date < today;
              return (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.description || '-'}</td>
                  <td className="px-4 py-3 font-semibold">{brl(r.amount_cents)}</td>
                  <td className={`px-4 py-3 ${overdue ? 'text-rose-600 font-medium' : 'text-gray-600'}`}>
                    {new Date(r.due_date).toLocaleDateString('pt-BR')}
                    {overdue && ' (vencido)'}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'paid' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">Pago</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'pending' && (
                      <button onClick={() => handlePay(r.id)} className="text-emerald-600 hover:underline text-sm font-medium">
                        Marcar pago
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BusinessLayout>
  );
}
