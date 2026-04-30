import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { listUsers, type AdminUser } from '../../services/adminApi';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  trialing: { label: 'Trial', color: 'bg-blue-100 text-blue-700' },
  cortesia: { label: 'Cortesia', color: 'bg-purple-100 text-purple-700' },
  overdue: { label: 'Overdue', color: 'bg-amber-100 text-amber-700' },
  blocked: { label: 'Bloqueado', color: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelado', color: 'bg-gray-200 text-gray-600' },
  incomplete: { label: 'Incompleto', color: 'bg-gray-100 text-gray-500' },
};

const STATUS_FILTER_OPTIONS = [
  '', 'active', 'trialing', 'cortesia', 'overdue', 'blocked', 'cancelled', 'incomplete', 'admin',
];

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await listUsers({ limit, offset, search: search || undefined, status: status || undefined });
      setUsers(r.users);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, status]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    load();
  }

  return (
    <AdminLayout title="Usuarios">
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, email ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setOffset(0); }}
          className="border rounded px-3 py-2 text-sm"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt ? STATUS_LABEL[opt]?.label || opt : 'Todos os status'}
            </option>
          ))}
        </select>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          Buscar
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Criado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Carregando...</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Nenhum usuario encontrado</td></tr>
            )}
            {users.map((u) => {
              const st = u.subscription_status || 'incomplete';
              const badge = STATUS_LABEL[st] || { label: st, color: 'bg-gray-100 text-gray-700' };
              return (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{u.name}</div>
                    {u.cpf && <div className="text-xs text-gray-500">CPF {u.cpf}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{u.phone_number || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/usuarios/${u.id}`} className="text-blue-600 hover:underline text-sm">
                      Ver
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
        <div>{total} usuarios</div>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Proximo
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
