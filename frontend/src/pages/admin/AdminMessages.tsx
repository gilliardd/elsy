import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { listMessages, type MessageLog } from '../../services/adminApi';

export default function AdminMessages() {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [direction, setDirection] = useState<'' | 'in' | 'out'>('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await listMessages({
        limit, offset,
        direction: direction || undefined,
        phone: phone || undefined,
      });
      setMessages(r.messages);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, direction]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    load();
  }

  return (
    <AdminLayout title="Mensagens">
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Filtrar por telefone (E.164: 5511999999999)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <select
          value={direction}
          onChange={(e) => { setDirection(e.target.value as any); setOffset(0); }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">Todas</option>
          <option value="in">Recebidas</option>
          <option value="out">Enviadas</option>
        </select>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          Buscar
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-sm border divide-y">
        {loading && <div className="px-4 py-6 text-center text-gray-500">Carregando...</div>}
        {!loading && messages.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500">Sem mensagens.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="px-4 py-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded mr-2 ${m.direction === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                  {m.direction === 'in' ? 'recebida' : 'enviada'}
                </span>
                {m.user_name && <span className="text-gray-700 font-medium">{m.user_name} · </span>}
                <span className="font-mono">{m.phone || '-'}</span>
                {m.status && <span className="ml-2">[{m.status}]</span>}
              </div>
              <div>{new Date(m.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <div className="text-sm whitespace-pre-wrap">{m.content || <em className="text-gray-400">[sem conteudo]</em>}</div>
            {m.error && <div className="text-xs text-rose-600 mt-1">erro: {m.error}</div>}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
        <div>{total} mensagens</div>
        <div className="flex gap-2">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="px-3 py-1 border rounded disabled:opacity-50">Anterior</button>
          <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="px-3 py-1 border rounded disabled:opacity-50">Proximo</button>
        </div>
      </div>
    </AdminLayout>
  );
}
