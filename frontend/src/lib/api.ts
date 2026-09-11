import { supabase } from './supabase';

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
type ApiOptions = RequestInit & { timeoutMs?: number };

export async function apiFetch<T = any>(path: string, options: ApiOptions = {}): Promise<Response> {
  const { timeoutMs = 25000, signal, ...fetchOptions } = options;
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers, signal: controller.signal });
    // Keep the timeout active until the complete body arrives.
    const body = await response.arrayBuffer();
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  } catch (error: any) {
    if (signal?.aborted) throw new Error('Żądanie anulowane.');
    if (controller.signal.aborted) throw new Error('Przekroczono czas oczekiwania na odpowiedź.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export async function apiJson<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${response.status}`);
  return data as T;
}
