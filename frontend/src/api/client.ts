/**
 */

const BASE_URL = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('access_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Only redirect to home if the user already has a stored session (expired token).
    // On the login page there is no token yet — just let the error propagate so the
    // form can display "Incorrect email or password."
    const hasSession = !!localStorage.getItem('access_token');
    if (hasSession) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  }

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      errorMsg = err.detail || errorMsg;
    } catch {}
    throw new ApiError(response.status, errorMsg);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
