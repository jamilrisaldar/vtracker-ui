/** Set for real Google Sign-In (mock auth mode only). */
export const googleClientId: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/**
 * When true, auth uses the backend at `apiBaseUrl()` (cookie session + CSRF per OpenAPI).
 * When false, auth uses the in-browser mock (Google / simulated).
 */
export function isBackendAuthEnabled(): boolean {
  const v = import.meta.env.VITE_USE_BACKEND_AUTH
  return v === 'true' || v === '1'
}

/**
 * API origin for fetches. Empty string = same origin (use Vite dev proxy to localhost:3001).
 * Example direct: `http://localhost:3001` (requires CORS on the server).
 */
export function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (raw === undefined || raw === '') return ''
  return raw.replace(/\/$/, '')
}

/** Absolute or same-origin path for `fetch`. */
export function apiUrl(path: string): string {
  const base = apiBaseUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
