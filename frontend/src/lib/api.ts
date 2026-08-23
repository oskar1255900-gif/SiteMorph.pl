import { supabase } from './supabase'

/**
 * Baza URL dla API. W dev Vite proxy /api -> http://localhost:8000,
 * w prod Vercel rewrite /api/* -> serwis backend. Zwykle zostaje ''.
 * Można nadpisać przez VITE_API_URL (np. przy osobnym hostingu backendu).
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/** fetch z JSON-em, bazą API i automatycznym tokenem Supabase (jeśli zalogowany). */
export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch {
    // brak sesji — idziemy jako anon
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers })
}

/** apiFetch + parsowanie JSON z rzucaniem błędu na !ok. */
export async function apiJson<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data as any)?.detail || `HTTP ${res.status}`)
  }
  return data as T
}
