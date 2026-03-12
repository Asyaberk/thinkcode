import { api } from './client';
import type { AuthUser } from '../types';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const data = await api.post<LoginResponse>('/auth/login', { email, password });
  localStorage.setItem('access_token', data.access_token);

  const user = await getMe();
  localStorage.setItem('user', JSON.stringify(user));
  return { token: data.access_token, user };
}

export async function getMe(): Promise<AuthUser> {
  return api.get<AuthUser>('/auth/me');
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getStoredToken(): string | null {
  return localStorage.getItem('access_token');
}
