import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { listPayments } from '../../services/adminApi';

const STATUS_OPTIONS = ['', 'pending', 'received', 'confirmed', 'overdue', 'refunded', 'cancelled'];

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await listPayments({ limit, offset, status: status || undefined });
      setPayments(r.payments);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, status]);

  return (
    <AdminLayout title="Pagamentos">
      <div className="mb-4">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setOffset(0); }}
          className="border rounded px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || 'Todos'}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr className="text-left">
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Pago em</th>
              <th className="px-4 py-3">Asaas ID</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Carregando...</td></tr>}
            {!loading && payments.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Sem pagamentos.</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">{p.user_name || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{p.phone_number || '-'}</td>
                <td className="px-4 py-3">{formatBRL(p.amount_cents)}</td>
                <td className="px-4 py-3">{p.status}</td>
                <td className="px-4 py-3 text-gray-600">{p.due_date ? new Date(p.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="px-4 py-3 text-gray-600">{p.paid_at ? new Date(p.paid_at).toLocaleString('pt-BR') : '-'}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.asaas_payment_id || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
        <div>{total} pagamentos</div>
        <div className="flex gap-2">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="px-3 py-1 border rounded disabled:opacity-50">Anterior</button>
          <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="px-3 py-1 border rounded disabled:opacity-50">Proximo</button>
        </div>
      </div>
    </AdminLayout>
  );
}
