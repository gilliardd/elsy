import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/admin/AdminProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import SavingsBoxes from './pages/SavingsBoxes';
import Reports from './pages/Reports';
import Bills from './pages/Bills';
import Orcamentos from './pages/Orcamentos';
import InvestCadastro from './pages/investments/Cadastro';
import InvestMovimento from './pages/investments/Movimento';
import InvestAnalise from './pages/investments/Analise';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminPlans from './pages/admin/AdminPlans';
import AdminPayments from './pages/admin/AdminPayments';
import AdminMessages from './pages/admin/AdminMessages';
import AdminSettings from './pages/admin/AdminSettings';

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{title}</h1>
          <p className="text-gray-500">Em desenvolvimento...</p>
        </div>
      </div>
    </div>
  );
}

function LoginRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />

          {/* Painel admin SaaS */}
          <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
          <Route path="/admin/usuarios" element={<AdminProtectedRoute><AdminUsers /></AdminProtectedRoute>} />
          <Route path="/admin/usuarios/:id" element={<AdminProtectedRoute><AdminUserDetail /></AdminProtectedRoute>} />
          <Route path="/admin/planos" element={<AdminProtectedRoute><AdminPlans /></AdminProtectedRoute>} />
          <Route path="/admin/pagamentos" element={<AdminProtectedRoute><AdminPayments /></AdminProtectedRoute>} />
          <Route path="/admin/mensagens" element={<AdminProtectedRoute><AdminMessages /></AdminProtectedRoute>} />
          <Route path="/admin/configuracoes" element={<AdminProtectedRoute><AdminSettings /></AdminProtectedRoute>} />

          {/* App de financas pessoais (admin tambem usa) */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/transacoes" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/categorias" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
          <Route path="/caixinhas" element={<ProtectedRoute><SavingsBoxes /></ProtectedRoute>} />
          <Route path="/contas" element={<ProtectedRoute><Bills /></ProtectedRoute>} />
          <Route path="/orcamentos" element={<ProtectedRoute><Orcamentos /></ProtectedRoute>} />
          <Route path="/investimentos/cadastro" element={<ProtectedRoute><InvestCadastro /></ProtectedRoute>} />
          <Route path="/investimentos/movimento" element={<ProtectedRoute><InvestMovimento /></ProtectedRoute>} />
          <Route path="/investimentos/analise" element={<ProtectedRoute><InvestAnalise /></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute><ComingSoon title="Configuracoes" /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
