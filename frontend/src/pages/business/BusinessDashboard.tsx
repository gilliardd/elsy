import { useEffect, useState } from 'react';
import BusinessLayout from '../../components/business/BusinessLayout';
import { getDashboard, type BusinessDashboard } from '../../services/businessApi';
import { TrendingUp, Users, Wallet, Calendar, AlertCircle } from 'lucide-react';

function brl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        <Icon size={20} className={color} />
      </div>
      <div className="text-2xl font-semibold text-gray-800">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function BusinessDashboardPage() {
  const [data, setData] = useState<BusinessDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e?.response?.data?.error || e?.message || 'Erro'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <BusinessLayout title="Dashboard">
      {loading && <div className="text-gray-500">Carregando...</div>}
      {error && <div className="text-rose-600">Erro: {error}</div>}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Caixa hoje"
              value={brl(data.today.cash.inCents)}
              sub={`${data.today.cash.countIn} entrada(s)${data.today.cash.outCents > 0 ? ` · saidas ${brl(data.today.cash.outCents)}` : ''}`}
              icon={Wallet}
              color="text-emerald-500"
            />
            <StatCard
              label="Faturamento ontem"
              value={brl(data.yesterday.cash.inCents)}
              icon={Calendar}
              color="text-blue-500"
            />
            <StatCard
              label="Faturamento do mes"
              value={brl(data.month.cash.inCents)}
              sub={data.prevMonth.revenueCents > 0 ? `Mes anterior: ${brl(data.prevMonth.revenueCents)}` : undefined}
              icon={TrendingUp}
              color="text-purple-500"
            />
            <StatCard
              label="A receber"
              value={brl(data.pending.totalCents)}
              sub={`${data.pending.upcoming.length} pendentes`}
              icon={AlertCircle}
              color="text-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-lg shadow-sm border p-5">
              <h2 className="text-sm font-semibold text-gray-600 mb-3">Proximos a receber</h2>
              {data.pending.upcoming.length === 0 ? (
                <div className="text-sm text-gray-500">Sem pendentes 🎉</div>
              ) : (
                <ul className="divide-y">
                  {data.pending.upcoming.map((r) => (
                    <li key={r.id} className="py-2 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-medium text-gray-800">{r.customer_name}</div>
                        <div className="text-xs text-gray-500">{r.description || 'sem descricao'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{brl(r.amount_cents)}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(r.due_date).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-lg shadow-sm border p-5">
              <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                <Users size={16} /> Top clientes do mes
              </h2>
              {data.topCustomers.length === 0 ? (
                <div className="text-sm text-gray-500">Sem dados ainda</div>
              ) : (
                <ul className="divide-y">
                  {data.topCustomers.map((c) => (
                    <li key={c.customer_id} className="py-2 flex justify-between text-sm">
                      <span className="font-medium text-gray-800">{c.name}</span>
                      <span className="font-semibold">{brl(c.total_cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </BusinessLayout>
  );
}
