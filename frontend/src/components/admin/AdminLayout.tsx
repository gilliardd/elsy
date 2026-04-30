import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Package,
  CreditCard,
  MessageSquare,
  Settings,
  ArrowLeft,
  LogOut,
} from 'lucide-react';

interface Props {
  title: string;
  children: React.ReactNode;
}

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Visao geral', exact: true },
  { to: '/admin/usuarios', icon: Users, label: 'Usuarios' },
  { to: '/admin/planos', icon: Package, label: 'Planos' },
  { to: '/admin/pagamentos', icon: CreditCard, label: 'Pagamentos' },
  { to: '/admin/mensagens', icon: MessageSquare, label: 'Mensagens' },
  { to: '/admin/configuracoes', icon: Settings, label: 'Configuracoes' },
];

export default function AdminLayout({ title, children }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-60 bg-gray-900 text-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="text-xl font-semibold">Elsy Admin</div>
          <div className="text-xs text-gray-400 truncate">{user?.username}</div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-sm transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-gray-800 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft size={18} />
            Voltar ao app
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800"
          >
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
