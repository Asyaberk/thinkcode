/**
 * useAuth.ts — Kimlik dogrulama hook'u
 *
 * localStorage'daki token ve kullanici bilgisini yonetir.
 * login() / logout() isaretleri App.tsx'ten gelen state'i gunceller.
 * Her sayfa render'inda once token kontrolu yapar.
 */
import { useState, useCallback, useEffect } from 'react';
import { login as apiLogin } from '../api/auth';
import type { AuthUser } from '../types';

interface UseAuthResult {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sayfa yuklendiginde localStorage'dan kullanici bilgisini yukle
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const stored = localStorage.getItem('auth_user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        // Bozuk veri — temizle
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_user');
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Backend /auth/login — returns { token, user: AuthUser }
      const data = await apiLogin(email, password);
      // auth.ts apiLogin zaten localStorage'a token ve user kaydediyor
      setUser(data.user);
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    setUser(null);
  }, []);

  return {
    user,
    isLoggedIn: !!user,
    isLoading,
    error,
    login,
    logout,
  };
}
