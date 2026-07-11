import { useAuthStore } from '@/stores/auth'

export const API_URL = import.meta.env.VITE_API_URL || '/api'

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown, message: string) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request(method: string, path: string, body?: unknown, options?: RequestInit) {
  const auth = useAuthStore()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  }
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`
  }

  const url = `${API_URL}${path}`
  const res = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    auth.logout()
    window.location.href = '/login'
  }

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    throw new ApiError(res.status, data, data?.error || `HTTP ${res.status}`)
  }

  return data
}

export const api = {
  get: (path: string, options?: RequestInit) => request('GET', path, undefined, options),
  post: (path: string, body: unknown, options?: RequestInit) => request('POST', path, body, options),
  patch: (path: string, body: unknown, options?: RequestInit) => request('PATCH', path, body, options),
  delete: (path: string, options?: RequestInit) => request('DELETE', path, undefined, options),
}

export function buildQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      q.set(key, String(value))
    }
  }
  return `?${q.toString()}`
}
