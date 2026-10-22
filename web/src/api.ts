import { auth, demoMode } from './firebase';
import { demoRequest } from './demo';

export async function api<T>(path: string, method = 'GET', body?: Record<string, unknown>): Promise<T> {
  if (demoMode) return demoRequest(path, method, body) as T;
  const token = await auth?.currentUser?.getIdToken();
  let sessionId = sessionStorage.getItem('vela-session-id');
  if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem('vela-session-id', sessionId); }
  const response = await fetch(`/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir. Tente novamente.');
  return payload as T;
}

export function browserId() {
  const key = 'vela-browser-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID(); localStorage.setItem(key, created); return created;
}
