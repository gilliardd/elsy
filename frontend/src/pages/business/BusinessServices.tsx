import { useEffect, useState } from 'react';
import BusinessLayout from '../../components/business/BusinessLayout';
import { listServices, createService, deleteService, type Service } from '../../services/businessApi';

function brl(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export default function BusinessServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', duration: '' });

  async function load() {
    setLoading(true);
    try {
      const items = await listServices(false);
      setServices(items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    const cents = Math.round(parseFloat(form.price.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    try {
      await createService({
        name: form.name.trim(),
        price_cents: cents,
        duration_minutes: form.duration ? parseInt(form.duration, 10) : undefined,
      });
      setForm({ name: '', price: '', duration: '' });
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Desativar este servico?')) return;
    await deleteService(id);
    await load();
  }

  return (
    <BusinessLayout title="Servicos / Catalogo">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          {showForm ? 'Cancelar' : 'Novo servico'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text" placeholder="Nome do servico *" required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="text" placeholder="Preco (ex: 50.00) *" required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="number" placeholder="Duracao (min)"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
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
              <th className="px-4 py-3">Preco</th>
              <th className="px-4 py-3">Duracao</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Carregando...</td></tr>}
            {!loading && services.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Sem servicos cadastrados.</td></tr>
            )}
            {services.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{brl(s.price_cents)}</td>
                <td className="px-4 py-3">{s.duration_minutes ? `${s.duration_minutes} min` : '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(s.id)} className="text-rose-600 hover:underline text-sm">
                    Desativar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BusinessLayout>
  );
}
