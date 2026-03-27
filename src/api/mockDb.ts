import type {
  Account,
  AccountFixedDeposit,
  AccountFixedDepositStatus,
  AccountTransaction,
  Invoice,
  CombinedPlotSaleGroup,
  LandPlot,
  PlotSale,
  PlotSaleAgentPayment,
  PlotSalePayment,
  Payment,
  Phase,
  Project,
  ProjectDocument,
  User,
  Vendor,
} from '../types'
import { plotCalculatedSqFtFromDimensions } from '../utils/landPlotDisplay'

const DB_KEY = 'vtracker-mock-db-v1'
const AUTH_KEY = 'vtracker-auth-session-v1'

export interface MockDatabase {
  users: User[]
  projects: Project[]
  phases: Phase[]
  plots: LandPlot[]
  plotSales: PlotSale[]
  plotSaleGroups: CombinedPlotSaleGroup[]
  plotSalePayments: PlotSalePayment[]
  plotSaleAgentPayments: PlotSaleAgentPayment[]
  vendors: Vendor[]
  invoices: Invoice[]
  payments: Payment[]
  accounts: Account[]
  accountTransactions: AccountTransaction[]
  /** Persisted without computed interest fields; enriched on read. */
  accountFixedDeposits: Omit<AccountFixedDeposit, 'dailyInterest' | 'daysElapsed' | 'accruedInterest'>[]
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
    plotSales: [],
    plotSaleGroups: [],
    plotSalePayments: [],
    vendors: [],
    invoices: [],
    payments: [],
    accounts: [],
    accountTransactions: [],
    accountFixedDeposits: [],
    documents: [],
    tokens: {},
  }
}

function migrateFixedDepositStoredStatus(raw: unknown): AccountFixedDepositStatus {
  const s = typeof raw === 'string' ? raw : 'active'
  if (s === 'open') return 'active'
  if (s === 'cashed') return 'cashed_pre_maturity'
  if (
    s === 'active' ||
    s === 'cashed_pre_maturity' ||
    s === 'matured' ||
    s === 'matured_rolled_over'
  )
    return s
  return 'active'
}

function migratePhase(p: Phase & { order?: number; description?: string }): Phase {
  const displayOrder =
    typeof p.displayOrder === 'number'
      ? p.displayOrder
      : typeof p.order === 'number'
        ? p.order
        : 0
  const legacyDesc = p.description
  const notes =
    p.notes ??
    (legacyDesc != null && String(legacyDesc).trim() !== ''
      ? String(legacyDesc)
      : undefined)
  return {
    id: p.id,
    projectId: p.projectId,
    name: p.name,
    notes,
    estimatedTotal: p.estimatedTotal,
    actualSpend: p.actualSpend,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    displayOrder,
  }
}

export function loadDb(): MockDatabase {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return emptyDb()
    const parsed = JSON.parse(raw) as MockDatabase & {
      phases?: (Phase & { order?: number; description?: string })[]
    }
    const migratedAccounts = (parsed.accounts ?? []).map((a) => {
      const ac = a as Account & { userId?: string }
      const { userId: _drop, ...rest } = ac
      return rest as Account
    })
    const migratedProjects = (parsed.projects ?? []).map((p) => {
      const pr = p as Project & { userId?: string }
      const { userId: _drop, ...rest } = pr
      return rest as Project
    })
    return {
      ...emptyDb(),
      ...parsed,
      tokens: parsed.tokens ?? {},
      projects: migratedProjects,
      accounts: migratedAccounts,
      accountTransactions: parsed.accountTransactions ?? [],
      accountFixedDeposits: (parsed.accountFixedDeposits ?? []).map((d) => ({
        ...d,
        status: migrateFixedDepositStoredStatus(d.status),
      })),
      phases: (parsed.phases ?? []).map(migratePhase),
      plotSales: parsed.plotSales ?? [],
      plotSaleGroups: parsed.plotSaleGroups ?? [],
      plotSalePayments: parsed.plotSalePayments ?? [],
      plotSaleAgentPayments: parsed.plotSaleAgentPayments ?? [],
      plots: (parsed.plots ?? []).map((p) => {
        const lp = p as LandPlot
        const merged: LandPlot = {
          ...lp,
          isPublicUse: lp.isPublicUse ?? false,
          isIrregular: lp.isIrregular ?? false,
        }
        if (merged.calculatedSquareFeet == null) {
          const c = plotCalculatedSqFtFromDimensions(merged)
          if (c != null) merged.calculatedSquareFeet = c
        }
        return merged
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
