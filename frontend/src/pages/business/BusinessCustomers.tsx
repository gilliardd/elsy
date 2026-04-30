import { useEffect, useState } from 'react';
import BusinessLayout from '../../components/business/BusinessLayout';
import { listCustomers, createCustomer, type Customer } from '../../services/businessApi';

function brl(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export default function BusinessCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });

  async function load() {
    setLoading(true);
    try {
      const r = await listCustomers({ search: search || undefined, limit: 200 });
      setCustomers(r.customers);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await createCustomer({
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
      });
      setForm({ name: '', phone: '', email: '', notes: '' });
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar');
    }
  }

  return (
    <BusinessLayout title="Clientes">
      <div className="flex gap-2 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Buscar por nome ou telefone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">
            Buscar
          </button>
        </form>
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          {showForm ? 'Cancelar' : 'Novo cliente'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text" placeholder="Nome *" required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="text" placeholder="Telefone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="email" placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Faturado</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Em aberto</th>
              <th className="px-4 py-3">Ultima visita</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Carregando...</td></tr>}
            {!loading && customers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Sem clientes ainda.</td></tr>
            )}
            {customers.map((c) => {
              const open = c.total_billed_cents - c.total_paid_cents;
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '-'}</td>
                  <td className="px-4 py-3">{brl(c.total_billed_cents)}</td>
                  <td className="px-4 py-3 text-emerald-600">{brl(c.total_paid_cents)}</td>
                  <td className={`px-4 py-3 ${open > 0 ? 'text-amber-600' : ''}`}>{brl(open)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('pt-BR') : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm text-gray-600">{total} cliente(s)</div>
    </BusinessLayout>
  );
}
