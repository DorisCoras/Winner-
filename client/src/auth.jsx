import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  admin: 'Sistem Yöneticisi',
  ik: 'İK Uzmanı',
  yonetici: 'Yönetici',
  personel: 'Personel',
};

export function AuthProvider({ children }) {
  // undefined = yükleniyor, null = oturum yok
  const [user, setUser] = useState(undefined);

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api.get('/auth/me');
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { user: u } = await api.post('/auth/login', { email, password });
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => {
    const role = user?.role;
    return {
      user,
      loading: user === undefined,
      login,
      logout,
      refresh,
      /** İK yetkisi: admin veya ik */
      isHR: role === 'admin' || role === 'ik',
      isAdmin: role === 'admin',
      isManager: role === 'yonetici',
      /** hasRole('admin', 'ik') */
      hasRole: (...roles) => !!role && roles.includes(role),
    };
  }, [user, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
