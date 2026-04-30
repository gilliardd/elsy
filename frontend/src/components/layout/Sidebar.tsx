import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  FolderOpen,
  Target,
  TrendingUp,
  FileText,
  Settings,
  Bot,
  PiggyBank,
  Bell,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  BarChart3,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transacoes', label: 'Transacoes', icon: ArrowLeftRight },
  { path: '/categorias', label: 'Categorias', icon: FolderOpen },
  { path: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
  { path: '/contas', label: 'Contas a Pagar', icon: Bell },
  { path: '/orcamentos', label: 'Orcamentos', icon: Target },
  { path: '/relatorios', label: 'Relatorios', icon: FileText },
  { path: '/configuracoes', label: 'Configuracoes', icon: Settings },
];

const investimentosSubmenus = [
  { path: '/investimentos/cadastro', label: 'Cadastro', icon: ClipboardList },
  { path: '/investimentos/movimento', label: 'Movimento', icon: TrendingUp },
  { path: '/investimentos/analise', label: 'Análise', icon: BarChart3 },
];

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [investimentosOpen, setInvestimentosOpen] = useState(
    location.pathname.startsWith('/investimentos')
  );

  const isInvestimentosActive = location.pathname.startsWith('/investimentos');
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Elsy</h1>
            <p className="text-xs text-gray-400">Controle Financeiro</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="px-4 pt-3 pb-1">
          <Link
            to="/admin"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            <Shield className="w-4 h-4" />
            Painel SaaS Admin
          </Link>
        </div>
      )}

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.slice(0, 6).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}

          {/* Investimentos com submenu */}
          <li>
            <button
              onClick={() => setInvestimentosOpen(!investimentosOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                isInvestimentosActive
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5" />
                <span>Investimentos</span>
              </div>
              {investimentosOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {investimentosOpen && (
              <ul className="mt-1 ml-4 space-y-1">
                {investimentosSubmenus.map((sub) => {
                  const isSubActive = location.pathname === sub.path;
                  const SubIcon = sub.icon;

                  return (
                    <li key={sub.path}>
                      <Link
                        to={sub.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                          isSubActive
                            ? 'bg-green-700 text-white'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <SubIcon className="w-4 h-4" />
                        <span>{sub.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>

          {menuItems.slice(6).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

    </aside>
  );
}
