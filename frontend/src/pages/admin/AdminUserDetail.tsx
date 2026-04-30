import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  getUserDetail,
  getUserMessages,
  grantCortesia,
  extendTrial,
  blockUser,
  unblockUser,
  type AdminUser,
  type Subscription,
  type Payment,
  type MessageLog,
} from '../../services/adminApi';

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);

  const [user, setUser] = useState<AdminUser | null>(null);
  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const detail = await getUserDetail(userId);
      setUser(detail.user);
      setActiveSub(detail.activeSubscription);
      setSubs(detail.subscriptions);
      setPayments(detail.payments);
      const msgs = await getUserMessages(userId, 50);
      setMessages(msgs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleCortesia() {
    const dateStr = prompt('Data de expiracao da cortesia (YYYY-MM-DD):');
    if (!dateStr) return;
    try {
      await grantCortesia(userId, dateStr);
      setActionMsg('Cortesia concedida.');
      await load();
    } catch (e: any) {
      setActionMsg(e?.response?.data?.error || 'Erro');
    }
  }

  async function handleExtendTrial() {
    const daysStr = prompt('Dias adicionais de trial:');
    if (!daysStr) return;
    const days = Number(daysStr);
    if (!days || days <= 0) return;
    try {
      await extendTrial(userId, days);
      setActionMsg(`Trial estendido em ${days} dias.`);
      await load();
    } catch (e: any) {
      setActionMsg(e?.response?.data?.error || 'Erro');
    }
  }

  async function handleBlock() {
    if (!confirm('Bloquear este usuario?')) return;
    await blockUser(userId);
    setActionMsg('Usuario bloqueado.');
    await load();
  }

  async function handleUnblock() {
    await unblockUser(userId, 'active');
    setActionMsg('Usuario desbloqueado.');
    await load();
  }

  if (loading) return <AdminLayout title="Usuario"><div>Carregando...</div></AdminLayout>;
  if (!user) return <AdminLayout title="Usuario"><div>Nao encontrado</div></AdminLayout>;

  return (
    <AdminLayout title={`Usuario: ${user.name}`}>
      <div className="mb-4">
        <Link to="/admin/usuarios" className="text-blue-600 hover:underline text-sm">← Voltar</Link>
      </div>

      {actionMsg && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm">
          {actionMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Dados do usuario */}
          <section className="bg-white rounded-lg shadow-sm border p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Dados</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-500">Nome</dt><dd>{user.name}</dd></div>
              <div><dt className="text-gray-500">Email</dt><dd>{user.email || '-'}</dd></div>
              <div><dt className="text-gray-500">Telefone</dt><dd>{user.phone_number || '-'}</dd></div>
              <div><dt className="text-gray-500">CPF</dt><dd>{user.cpf || '-'}</dd></div>
              <div><dt className="text-gray-500">Status</dt><dd>{user.subscription_status || '-'}</dd></div>
              <div><dt className="text-gray-500">Trial usado</dt><dd>{user.trial_used ? 'Sim' : 'Nao'}</dd></div>
              <div><dt className="text-gray-500">Asaas customer</dt><dd className="font-mono text-xs">{user.asaas_customer_id || '-'}</dd></div>
              <div><dt className="text-gray-500">Cadastrado em</dt><dd>{new Date(user.created_at).toLocaleString('pt-BR')}</dd></div>
            </dl>
          </section>

          {/* Assinatura ativa */}
          <section className="bg-white rounded-lg shadow-sm border p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Assinatura ativa</h2>
            {activeSub ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-500">Status</dt><dd>{activeSub.status}</dd></div>
                <div><dt className="text-gray-500">Plano (id)</dt><dd>{activeSub.plan_id}</dd></div>
                <div><dt className="text-gray-500">Trial termina</dt><dd>{activeSub.trial_ends_at ? new Date(activeSub.trial_ends_at).toLocaleDateString('pt-BR') : '-'}</dd></div>
                <div><dt className="text-gray-500">Periodo termina</dt><dd>{activeSub.current_period_end ? new Date(activeSub.current_period_end).toLocaleDateString('pt-BR') : '-'}</dd></div>
                <div><dt className="text-gray-500">Cancelar ao fim</dt><dd>{activeSub.cancel_at_period_end ? 'Sim' : 'Nao'}</dd></div>
                <div><dt className="text-gray-500">Asaas sub</dt><dd className="font-mono text-xs">{activeSub.asaas_subscription_id || '-'}</dd></div>
              </dl>
            ) : <div className="text-gray-500 text-sm">Sem assinatura ativa.</div>}
          </section>

          {/* Pagamentos */}
          <section className="bg-white rounded-lg shadow-sm border p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Pagamentos</h2>
            {payments.length === 0 ? (
              <div className="text-gray-500 text-sm">Sem pagamentos.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-gray-500 border-b">
                  <tr><th className="text-left py-2">Status</th><th className="text-left py-2">Valor</th><th className="text-left py-2">Vencimento</th><th className="text-left py-2">Pago em</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2">{p.status}</td>
                      <td className="py-2">{formatBRL(p.amount_cents)}</td>
                      <td className="py-2">{p.due_date ? new Date(p.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="py-2">{p.paid_at ? new Date(p.paid_at).toLocaleString('pt-BR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Mensagens recentes */}
          <section className="bg-white rounded-lg shadow-sm border p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Mensagens recentes ({messages.length})</h2>
            <div className="space-y-2 max-h-96 overflow-auto">
              {messages.map((m) => (
                <div key={m.id} className={`text-xs p-2 rounded ${m.direction === 'in' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <div className="text-gray-500 mb-1">
                    {new Date(m.created_at).toLocaleString('pt-BR')} • {m.direction === 'in' ? 'recebida' : 'enviada'} • {m.status || '-'}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content || '[sem conteudo]'}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {/* Acoes */}
          <section className="bg-white rounded-lg shadow-sm border p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Acoes</h2>
            <div className="space-y-2">
              <button onClick={handleCortesia} className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
                Conceder cortesia
              </button>
              <button onClick={handleExtendTrial} className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                Estender trial
              </button>
              {user.subscription_status === 'blocked' ? (
                <button onClick={handleUnblock} className="w-full px-3 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">
                  Desbloquear
                </button>
              ) : (
                <button onClick={handleBlock} className="w-full px-3 py-2 bg-rose-600 text-white rounded text-sm hover:bg-rose-700">
                  Bloquear
                </button>
              )}
            </div>
          </section>

          {/* Historico de assinaturas */}
          <section className="bg-white rounded-lg shadow-sm border p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Historico ({subs.length})</h2>
            <div className="space-y-2 text-xs">
              {subs.map((s) => (
                <div key={s.id} className="border-b last:border-0 pb-2">
                  <div>#{s.id} — {s.status}</div>
                  <div className="text-gray-500">criado: {new Date(s.created_at).toLocaleDateString('pt-BR')}</div>
                  {s.cancelled_at && (
                    <div className="text-gray-500">cancelado: {new Date(s.cancelled_at).toLocaleDateString('pt-BR')}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
