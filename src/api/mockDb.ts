import type {
  Invoice,
  Payment,
  Phase,
  Project,
  ProjectDocument,
  User,
  Vendor,
} from '../types'

const DB_KEY = 'vtracker-mock-db-v1'
const AUTH_KEY = 'vtracker-auth-session-v1'

export interface MockDatabase {
  users: User[]
  projects: Project[]
  phases: Phase[]
  vendors: Vendor[]
  invoices: Invoice[]
  payments: Payment[]
  documents: ProjectDocument[]
  /** Maps session token → user id */
  tokens: Record<string, string>
}

function emptyDb(): MockDatabase {
  return {
    users: [],
    projects: [],
    phases: [],
    vendors: [],
    invoices: [],
    payments: [],
    documents: [],
    tokens: {},
  }
}

function migratePhase(p: Phase & { order?: number }): Phase {
  const displayOrder =
    typeof p.displayOrder === 'number'
      ? p.displayOrder
      : typeof p.order === 'number'
        ? p.order
        : 0
  return { ...p, displayOrder }
}

export function loadDb(): MockDatabase {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return emptyDb()
    const parsed = JSON.parse(raw) as MockDatabase & {
      phases?: (Phase & { order?: number })[]
    }
    return {
      ...emptyDb(),
      ...parsed,
      tokens: parsed.tokens ?? {},
      phases: (parsed.phases ?? []).map(migratePhase),
    }
  } catch {
    return emptyDb()
  }
}

export function saveDb(db: MockDatabase): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

export function readAuthSession(): { token: string; userId: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { token: string; userId: string }
  } catch {
    return null
  }
}

export function writeAuthSession(token: string, userId: string): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, userId }))
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_KEY)
}

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
