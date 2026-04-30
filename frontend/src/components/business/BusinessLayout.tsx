import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Wallet,
  LogOut,
  Bot,
} from 'lucide-react';

interface Props {
  title: string;
  children: React.ReactNode;
}

const items = [
  { to: '/empresa', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/empresa/clientes', icon: Users, label: 'Clientes' },
  { to: '/empresa/servicos', icon: Package, label: 'Servicos' },
  { to: '/empresa/recebiveis', icon: Receipt, label: 'Recebiveis' },
  { to: '/empresa/caixa', icon: Wallet, label: 'Caixa' },
];

export default function BusinessLayout({ title, children }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-60 bg-emerald-900 text-emerald-50 flex flex-col">
        <div className="p-4 border-b border-emerald-800">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-emerald-300" />
            <div>
              <div className="text-base font-semibold">Elsy Empresa</div>
              <div className="text-xs text-emerald-300 truncate">{user?.email || user?.username}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-sm transition ${
                  isActive ? 'bg-emerald-700 text-white' : 'text-emerald-100 hover:bg-emerald-800'
                }`
              }
            >
              <it.icon size={18} />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-emerald-800">
          <Link to="/configuracoes" className="flex items-center gap-3 px-3 py-2 rounded text-sm text-emerald-100 hover:bg-emerald-800">
            Configuracoes
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-emerald-100 hover:bg-emerald-800">
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
        </header>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
