import type {
  Account,
  AccountTransaction,
  Invoice,
  LandPlot,
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
  plots: LandPlot[]
  vendors: Vendor[]
  invoices: Invoice[]
  payments: Payment[]
  accounts: Account[]
  accountTransactions: AccountTransaction[]
  documents: ProjectDocument[]
  /** Maps session token → user id */
  tokens: Record<string, string>
}

function emptyDb(): MockDatabase {
  return {
    users: [],
    projects: [],
    phases: [],
    plots: [],
    vendors: [],
    invoices: [],
    payments: [],
    accounts: [],
    accountTransactions: [],
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
    const migratedAccounts = (parsed.accounts ?? []).map((a) => {
      const ac = a as Account & { userId?: string }
      const { userId: _drop, ...rest } = ac
      return rest as Account
    })
    return {
      ...emptyDb(),
      ...parsed,
      tokens: parsed.tokens ?? {},
      accounts: migratedAccounts,
      accountTransactions: parsed.accountTransactions ?? [],
      phases: (parsed.phases ?? []).map(migratePhase),
      plots: (parsed.plots ?? []).map((p) => {
        const lp = p as LandPlot
        return {
          ...lp,
          isPublicUse: lp.isPublicUse ?? false,
          isIrregular: lp.isIrregular ?? false,
        }
      }),
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
