import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface User {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: 'admin' | 'user' | 'viewer';
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface UpdateProfileData {
  name?: string;
  email?: string | null;
  currentPassword?: string;
  newPassword?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'finbot_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved auth on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedAuth) {
      try {
        const { user, token } = JSON.parse(savedAuth);
        setUser(user);
        setToken(token);
        // Validate token by fetching user
        validateToken(token);
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  async function validateToken(authToken: string) {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        logout();
        return;
      }

      const data = await response.json();
      if (data.success && data.data) {
        setUser(data.data);
      } else {
        logout();
      }
    } catch {
      logout();
    }
  }

  async function login(username: string, password: string) {
    // Frontend atual atende apenas o admin. Login de usuario comum (telefone +
    // senha) entra na Fase 5 com /admin/* segregado e fluxo proprio.
    const response = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao fazer login');
    }

    const { user: userData, token: authToken } = data.data;
    setUser(userData);
    setToken(authToken);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: userData, token: authToken }));
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  async function updateProfile(data: UpdateProfileData) {
    if (!token) {
      throw new Error('Nao autenticado');
    }

    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Erro ao atualizar perfil');
    }

    // Update local user state
    const updatedUser = result.data;
    setUser(updatedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: updatedUser, token }));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
