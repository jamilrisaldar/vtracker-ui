/** In-memory user id when using cookie-based API auth (sync access for mock data layer). */
let cachedUserId: string | null = null

export function setApiSessionUserId(id: string | null): void {
  cachedUserId = id
}

export function getApiSessionUserId(): string | null {
  return cachedUserId
}
