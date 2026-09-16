'use client';

/** Client API FinGuard : toutes les requêtes passent par le proxy /api. */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('fg_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('fg_token', token);
  else localStorage.removeItem('fg_token');
}

async function request<T = any>(path: string, options: { method?: string; body?: any; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = options.token !== undefined ? options.token : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.message || 'Une erreur est survenue.', res.status);
  }
  return data as T;
}

/**
 * Télécharge un fichier (export CSV) via le proxy /api, avec le jeton JWT.
 * Déclenche l'enregistrement dans le navigateur.
 */
export async function downloadFile(path: string, fallbackName = 'export.csv'): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.message || 'Le téléchargement a échoué.', res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] || fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: 'POST', body }),
  patch: (path: string, body?: any) => request(path, { method: 'PATCH', body }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body }),
  del: (path: string) => request(path, { method: 'DELETE' }),
};
