import { useEffect, useState } from 'react';
import BusinessLayout from '../../components/business/BusinessLayout';
import { getCash, createCashMovement, type CashMovement, type CashSummary } from '../../services/businessApi';

function brl(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function todayISO() { return new Date().toISOString().split('T')[0]; }

export default function BusinessCash() {
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ type: 'in' | 'out'; amount: string; description: string }>({ type: 'out', amount: '', description: '' });

  async function load() {
    setLoading(true);
    try {
      const r = await getCash(from, to);
      setSummary(r.summary);
      setMovements(r.movements);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount) return;
    const cents = Math.round(parseFloat(form.amount.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    try {
      await createCashMovement({
        type: form.type,
        amount_cents: cents,
        description: form.description || undefined,
        date: todayISO(),
      });
      setForm({ type: 'out', amount: '', description: '' });
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao salvar');
    }
  }

  return (
    <BusinessLayout title="Caixa">
      <div className="flex gap-2 mb-4 items-end">
        <label className="text-sm">
          <div className="text-gray-500 mb-1">De</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <div className="text-gray-500 mb-1">Ate</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-3 py-2 text-sm" />
        </label>
        <button onClick={load} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">
          Atualizar
        </button>
        <div className="flex-1" />
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          {showForm ? 'Cancelar' : 'Novo movimento'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="out">Saida</option>
            <option value="in">Entrada</option>
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
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">
            Salvar
          </button>
        </form>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-5">
            <div className="text-sm text-gray-500 mb-1">Entradas</div>
            <div className="text-2xl font-semibold text-emerald-600">{brl(summary.inCents)}</div>
            <div className="text-xs text-gray-500 mt-1">{summary.countIn} movimento(s)</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-5">
            <div className="text-sm text-gray-500 mb-1">Saidas</div>
            <div className="text-2xl font-semibold text-rose-600">{brl(summary.outCents)}</div>
            <div className="text-xs text-gray-500 mt-1">{summary.countOut} movimento(s)</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-5">
            <div className="text-sm text-gray-500 mb-1">Saldo</div>
            <div className={`text-2xl font-semibold ${summary.balanceCents >= 0 ? 'text-gray-800' : 'text-rose-600'}`}>
              {brl(summary.balanceCents)}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr className="text-left">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Descricao</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Carregando...</td></tr>}
            {!loading && movements.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Sem movimentos no periodo.</td></tr>
            )}
            {movements.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-3 text-gray-600">{new Date(m.date).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">
                  {m.type === 'in' ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">Entrada</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs">Saida</span>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold">{brl(m.amount_cents)}</td>
                <td className="px-4 py-3 text-gray-600">{m.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BusinessLayout>
  );
}
