import { apiUrl } from '../config'
import { fetchCsrfToken, readErrorMessage } from './backendAuth'

export type AdminRole = { id: number; name: string }

export type AdminUserRow = {
  id: number
  email: string
  roles: AdminRole[]
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase()
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const headers = new Headers(init.headers)
  if (needsCsrf) {
    const csrf = await fetchCsrfToken()
    headers.set('X-CSRF-Token', csrf)
  }
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const r = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  })
  if (r.status === 204) {
    return undefined as T
  }
  if (!r.ok) throw new Error(await readErrorMessage(r))
  const text = await r.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function adminListRoles(): Promise<AdminRole[]> {
  const j = await apiJson<{ roles: AdminRole[] }>('/api/v1/admin/roles')
  return j.roles
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const j = await apiJson<{ users: AdminUserRow[] }>('/api/v1/admin/users')
  return j.users
}

export async function adminCreateUser(input: {
  email: string
  password: string
  roleIds: number[]
}): Promise<{ id: number }> {
  return apiJson<{ id: number }>('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adminUpdateUser(
  userId: number,
  patch: { email?: string; password?: string; roleIds?: number[] },
): Promise<void> {
  await apiJson(`/api/v1/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function adminDeleteUser(userId: number): Promise<void> {
  await apiJson(`/api/v1/admin/users/${userId}`, { method: 'DELETE' })
}
