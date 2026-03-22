import type { AuthSession, User } from '../types'
import { apiUrl } from '../config'
import { setApiSessionUserId } from './apiAuthState'

/** Session user shape from OpenAPI `SessionUser`. */
interface SessionUserDto {
  id: number | string
  email: string
  roles?: { id: number | string; name: string }[]
}

function mapSessionUser(u: SessionUserDto): User {
  return {
    id: String(u.id),
    email: u.email,
    name: u.email.split('@')[0] || u.email,
    roles: u.roles?.map((r) => ({
      id: typeof r.id === 'string' ? Number(r.id) : r.id,
      name: r.name,
    })),
  }
}

export async function readErrorMessage(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { message?: string; error?: string }
    return j.message ?? j.error ?? `Request failed (${r.status})`
  } catch {
    return `Request failed (${r.status})`
  }
}

export async function fetchCsrfToken(): Promise<string> {
  const r = await fetch(apiUrl('/api/v1/auth/csrf-token'), {
    credentials: 'include',
  })
  if (!r.ok) throw new Error(await readErrorMessage(r))
  const j = (await r.json()) as { csrfToken?: string }
  if (!j.csrfToken) throw new Error('No CSRF token from server')
  return j.csrfToken
}

export async function loginWithEmailPassword(
  email: string,
  password: string,
): Promise<AuthSession> {
  const csrf = await fetchCsrfToken()
  const r = await fetch(apiUrl('/api/v1/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) throw new Error(await readErrorMessage(r))
  const j = (await r.json()) as { user?: SessionUserDto; csrfToken?: string }
  if (!j.user) throw new Error('Invalid login response')
  const user = mapSessionUser(j.user)
  setApiSessionUserId(user.id)
  return { user }
}

export async function getSessionFromApi(): Promise<AuthSession | null> {
  const r = await fetch(apiUrl('/api/v1/auth/me'), { credentials: 'include' })
  if (r.status === 401) {
    setApiSessionUserId(null)
    return null
  }
  if (!r.ok) throw new Error(await readErrorMessage(r))
  const j = (await r.json()) as { user?: SessionUserDto }
  if (!j.user) {
    setApiSessionUserId(null)
    return null
  }
  const user = mapSessionUser(j.user)
  setApiSessionUserId(user.id)
  return { user }
}

export async function logoutFromApi(): Promise<void> {
  const csrf = await fetchCsrfToken()
  const r = await fetch(apiUrl('/api/v1/auth/logout'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrf },
  })
  setApiSessionUserId(null)
  if (r.status === 401) return
  if (r.status === 204 || r.ok) return
  throw new Error(await readErrorMessage(r))
}
