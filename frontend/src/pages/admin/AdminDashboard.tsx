import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { getMetrics, type Metrics } from '../../services/adminApi';
import {
  Users as UsersIcon,
  TrendingUp,
  Clock,
  AlertTriangle,
  Ban,
  Gift,
  XCircle,
} from 'lucide-react';

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        <Icon size={20} className={color} />
      </div>
      <div className="text-2xl font-semibold text-gray-800">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMetrics()
      .then(setMetrics)
      .catch((e) => setError(e?.message || 'Erro ao carregar metricas'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout title="Visao geral">
      {loading && <div className="text-gray-500">Carregando...</div>}
      {error && <div className="text-red-600">Erro: {error}</div>}
      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="MRR estimado"
              value={formatBRL(metrics.mrrCents)}
              icon={TrendingUp}
              color="text-emerald-500"
              subtitle="Soma dos planos ativos + trialing"
            />
            <StatCard
              label="Signups (30d)"
              value={metrics.signupsLast30d}
              icon={UsersIcon}
              color="text-blue-500"
            />
            <StatCard
              label="Total de usuarios"
              value={metrics.users.total}
              icon={UsersIcon}
              color="text-gray-500"
            />
            <StatCard
              label="Churn (30d)"
              value={metrics.churnLast30d}
              icon={XCircle}
              color="text-rose-500"
              subtitle="Assinaturas canceladas"
            />
          </div>

          <h2 className="text-sm font-semibold text-gray-700 mb-3">Por status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Ativos" value={metrics.users.active} icon={TrendingUp} color="text-emerald-500" />
            <StatCard label="Em trial" value={metrics.users.trialing} icon={Clock} color="text-blue-500" />
            <StatCard label="Cortesia" value={metrics.users.cortesia} icon={Gift} color="text-purple-500" />
            <StatCard label="Overdue" value={metrics.users.overdue} icon={AlertTriangle} color="text-amber-500" />
            <StatCard label="Bloqueados" value={metrics.users.blocked} icon={Ban} color="text-rose-500" />
            <StatCard label="Cancelados" value={metrics.users.cancelled} icon={XCircle} color="text-gray-400" />
            <StatCard label="Incompletos" value={metrics.users.incomplete} icon={Clock} color="text-gray-400" />
            <StatCard label="Admin" value={metrics.users.admin} icon={UsersIcon} color="text-gray-700" />
          </div>
        </>
      )}
    </AdminLayout>
  );
}
