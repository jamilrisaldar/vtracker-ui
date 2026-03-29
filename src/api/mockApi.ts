import type {
  Account,
  AccountFixedDeposit,
  AccountFixedDepositStatus,
  AccountTransaction,
  AccountTransactionListFilters,
  AuthSession,
  DocumentKind,
  Invoice,
  InvoiceStatus,
  InvoiceUpdatePatch,
  CombinedPlotSaleGroup,
  LandPlot,
  PlotSale,
  PlotSaleAgentPayment,
  PlotSalePayment,
  Payment,
  Phase,
  PhaseStatus,
  PlotStatus,
  Project,
  ProjectDocument,
  ProjectReport,
  ProjectStatus,
  PlotSaleReportResponse,
  User,
  Vendor,
  GlCategory,
  GlSubcategory,
  GlAccount,
  GeneralLedgerEntry,
  VendorDisbursementBatch,
  VendorAdvance,
  VendorAdvanceUsage,
} from '../types'
import { isBackendAuthEnabled } from '../config'
import { enrichAccountFixedDeposit } from '../utils/fixedDepositMetrics'
import { plotCalculatedSqFtFromDimensions } from '../utils/landPlotDisplay'
import { invoiceTotalWithGst } from '../utils/invoiceTotals'
import {
  clearAuthSession,
  id,
  loadDb,
  readAuthSession,
  saveDb,
  writeAuthSession,
  type MockDatabase,
} from './mockDb'
import { getApiSessionUserId } from './apiAuthState'

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

function mockFindSaleGroup(
  db: MockDatabase,
  projectId: string,
  plotId: string,
): CombinedPlotSaleGroup | undefined {
  return db.plotSaleGroups.find((g) => g.projectId === projectId && g.plotIds.includes(plotId))
}

function mockEnrichPlot(db: MockDatabase, p: LandPlot): LandPlot {
  const g = mockFindSaleGroup(db, p.projectId, p.id)
  if (!g) return { ...p }
  const labels = g.plotIds
    .map((pid) => db.plots.find((x) => x.id === pid)?.plotNumber?.trim())
    .filter((x): x is string => !!x && x.length > 0)
  return {
    ...p,
    combinedSale: {
      groupId: g.id,
      displayName: g.displayName,
      plotCount: g.plotIds.length,
      plotNumbersSummary: labels.length ? [...labels].sort().join(', ') : undefined,
    },
  }
}

function mockSubstantivePlotSale(s: PlotSale): boolean {
  if (s.purchaserName?.trim()) return true
  if (s.subregistrarRegistrationDate?.trim()) return true
  if (s.negotiatedFinalPrice != null && s.negotiatedFinalPrice !== 0) return true
  if (s.agentCommissionPercent != null && s.agentCommissionPercent !== 0) return true
  if (s.agentCommissionAmount != null && s.agentCommissionAmount !== 0) return true
  if (s.stampDutyPrice != null && s.stampDutyPrice !== 0) return true
  if (s.agreementPrice != null && s.agreementPrice !== 0) return true
  return false
}

function mockPlotHasSoloPayments(db: MockDatabase, plotId: string): boolean {
  return (
    db.plotSalePayments.some((p) => p.plotId === plotId) ||
    db.plotSaleAgentPayments.some((p) => p.plotId === plotId)
  )
}

function plotNumberLabelsFromIds(
  plotIds: string[] | undefined,
  plots: LandPlot[],
): string | undefined {
  if (!plotIds?.length) return undefined
  const labels = plotIds
    .map((pid) => plots.find((p) => p.id === pid)?.plotNumber)
    .filter((s): s is string => Boolean(s?.trim()))
  if (labels.length === 0) return undefined
  return [...new Set(labels)].sort((a, b) => a.localeCompare(b)).join(', ')
}

function nowIso(): string {
  return new Date().toISOString()
}

function getUserIdOrThrow(): string {
  if (isBackendAuthEnabled()) {
    const uid = getApiSessionUserId()
    if (!uid) throw new Error('Unauthorized')
    return uid
  }
  const s = readAuthSession()
  if (!s) throw new Error('Unauthorized')
  const db = loadDb()
  if (!db.tokens[s.token] || db.tokens[s.token] !== s.userId) {
    clearAuthSession()
    throw new Error('Unauthorized')
  }
  return s.userId
}

/** Parses Google credential JWT payload (client-side only; replace with backend verification in production). */
export function parseGoogleCredential(credential: string): {
  sub: string
  email: string
  name: string
  picture?: string
} {
  const parts = credential.split('.')
  if (parts.length < 2) throw new Error('Invalid credential')
  const payload = parts[1]
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(pad)
  const json = atob(padded)
  const data = JSON.parse(json) as Record<string, string | undefined>
  if (!data.sub || !data.email) throw new Error('Invalid credential payload')
  return {
    sub: data.sub,
    email: data.email,
    name: data.name ?? data.email,
    picture: data.picture,
  }
}

export async function loginWithGoogleCredential(
  credential: string,
): Promise<AuthSession> {
  await delay()
  const p = parseGoogleCredential(credential)
  return finalizeGoogleProfile(p)
}

export async function loginWithMockGoogle(): Promise<AuthSession> {
  await delay()
  return finalizeGoogleProfile({
    sub: 'mock_google_stable_owner',
    email: 'demo.owner@example.com',
    name: 'Demo Owner',
    picture: undefined,
  })
}

async function finalizeGoogleProfile(p: {
  sub: string
  email: string
  name: string
  picture?: string
}): Promise<AuthSession> {
  const db = loadDb()
  let user = db.users.find((u) => u.googleSub === p.sub)
  if (!user) {
    user = {
      id: id('user'),
      email: p.email,
      name: p.name,
      picture: p.picture,
      googleSub: p.sub,
      createdAt: nowIso(),
      roles: [{ id: 1, name: 'Administrator' }],
    } satisfies User
    db.users.push(user)
  } else {
    user.name = p.name
    user.picture = p.picture
    if (!user.roles?.length) {
      user.roles = [{ id: 1, name: 'Administrator' }]
    }
  }
  const token = `tok_${crypto.randomUUID()}`
  db.tokens[token] = user.id
  saveDb(db)
  writeAuthSession(token, user.id)
  return { token, user }
}

export async function logout(): Promise<void> {
  await delay(40)
  const s = readAuthSession()
  if (s) {
    const db = loadDb()
    delete db.tokens[s.token]
    saveDb(db)
  }
  clearAuthSession()
}

export async function getSession(): Promise<AuthSession | null> {
  await delay(40)
  const s = readAuthSession()
  if (!s) return null
  const db = loadDb()
  const uid = db.tokens[s.token]
  if (!uid || uid !== s.userId) {
    clearAuthSession()
    return null
  }
  const user = db.users.find((u) => u.id === uid)
  if (!user) {
    clearAuthSession()
    return null
  }
  return { token: s.token, user }
}

// —— Projects ——

export async function listProjects(): Promise<Project[]> {
  await delay()
  getUserIdOrThrow()
  return loadDb()
    .projects.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getProject(projectId: string): Promise<Project | null> {
  await delay()
  getUserIdOrThrow()
  const p = loadDb().projects.find((x) => x.id === projectId)
  if (!p) return null
  return p
}

export async function createProject(input: {
  name: string
  description: string
  location?: string
  status?: ProjectStatus
}): Promise<Project> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const t = nowIso()
  const project: Project = {
    id: id('proj'),
    name: input.name.trim(),
    description: input.description.trim(),
    location: input.location?.trim() || undefined,
    status: input.status ?? 'planning',
    createdAt: t,
    updatedAt: t,
  }
  db.projects.push(project)
  saveDb(db)
  return project
}

export async function updateProject(
  projectId: string,
  patch: Partial<
    Pick<Project, 'name' | 'description' | 'location' | 'status'>
  >,
): Promise<Project> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const p = db.projects.find((x) => x.id === projectId)
  if (!p) throw new Error('Not found')
  if (patch.name != null) p.name = patch.name.trim()
  if (patch.description != null) p.description = patch.description.trim()
  if (patch.location !== undefined) p.location = patch.location?.trim() || undefined
  if (patch.status != null) p.status = patch.status
  p.updatedAt = nowIso()
  saveDb(db)
  return p
}

export async function deleteProject(projectId: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const p = db.projects.find((x) => x.id === projectId)
  if (!p) throw new Error('Not found')
  db.projects = db.projects.filter((x) => x.id !== projectId)
  db.phases = db.phases.filter((x) => x.projectId !== projectId)
  db.plots = db.plots.filter((x) => x.projectId !== projectId)
  db.vendors = db.vendors.filter((x) => x.projectId !== projectId)
  const invIds = new Set(
    db.invoices.filter((i) => i.projectId === projectId).map((i) => i.id),
  )
  db.invoices = db.invoices.filter((i) => i.projectId !== projectId)
  db.payments = db.payments.filter(
    (p) => p.projectId !== projectId && !invIds.has(p.invoiceId),
  )
  db.accounts = db.accounts.map((a) =>
    a.projectId === projectId ? { ...a, projectId: undefined } : a,
  )
  db.accountTransactions = db.accountTransactions.map((t) =>
    t.projectId === projectId ? { ...t, projectId: undefined } : t,
  )
  db.documents = db.documents.filter((d) => d.projectId !== projectId)
  saveDb(db)
}

// —— Phases ——

export async function listPhases(projectId: string): Promise<Phase[]> {
  await delay()
  getUserIdOrThrow()
  const project = await getProject(projectId)
  if (!project) throw new Error('Not found')
  return loadDb()
    .phases.filter((x) => x.projectId === projectId)
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder || a.startDate.localeCompare(b.startDate),
    )
}

export async function createPhase(input: {
  projectId: string
  name: string
  notes?: string
  startDate: string
  endDate: string
  status?: PhaseStatus
  estimatedTotal?: number
  actualSpend?: number
}): Promise<Phase> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const existing = db.phases.filter((x) => x.projectId === input.projectId)
  const displayOrder =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((x) => x.displayOrder)) + 1
  const phase: Phase = {
    id: id('phase'),
    projectId: input.projectId,
    name: input.name.trim(),
    notes: input.notes?.trim() || undefined,
    estimatedTotal: input.estimatedTotal,
    actualSpend: input.actualSpend,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status ?? 'not_started',
    displayOrder,
  }
  db.phases.push(phase)
  project.updatedAt = nowIso()
  saveDb(db)
  return phase
}

export async function updatePhase(
  phaseId: string,
  patch: Partial<{
    name: string
    notes: string | null
    startDate: string
    endDate: string
    status: PhaseStatus
    displayOrder: number
    estimatedTotal: number | null
    actualSpend: number | null
  }>,
  _projectId?: string,
): Promise<Phase> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const ph = db.phases.find((x) => x.id === phaseId)
  if (!ph) throw new Error('Not found')
  if (_projectId && ph.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === ph.projectId)
  if (!proj) throw new Error('Not found')
  if (patch.name != null) ph.name = patch.name.trim()
  if (patch.notes !== undefined) ph.notes = patch.notes?.trim() || undefined
  if (patch.estimatedTotal !== undefined) ph.estimatedTotal = patch.estimatedTotal ?? undefined
  if (patch.actualSpend !== undefined) ph.actualSpend = patch.actualSpend ?? undefined
  if (patch.startDate != null) ph.startDate = patch.startDate
  if (patch.endDate != null) ph.endDate = patch.endDate
  if (patch.status != null) ph.status = patch.status
  if (patch.displayOrder != null) ph.displayOrder = patch.displayOrder
  proj.updatedAt = nowIso()
  saveDb(db)
  return ph
}

export async function deletePhase(phaseId: string, _projectId?: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const ph = db.phases.find((x) => x.id === phaseId)
  if (!ph) throw new Error('Not found')
  if (_projectId && ph.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === ph.projectId)
  if (!proj) throw new Error('Not found')
  db.phases = db.phases.filter((x) => x.id !== phaseId)
  proj.updatedAt = nowIso()
  saveDb(db)
}

// —— Plots ——

export async function listPlots(projectId: string): Promise<LandPlot[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  const db = loadDb()
  return db.plots
    .filter((x) => x.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => mockEnrichPlot(db, p))
}

export async function createPlot(input: {
  projectId: string
  plotNumber?: string
  isIrregular?: boolean
  widthFeet?: number
  lengthFeet?: number
  widthFeet2?: number
  lengthFeet2?: number
  totalSquareFeetOverride?: number
  pricePerSqft: number
  totalPurchasePrice?: number
  currency?: string
  isReserved?: boolean
  status?: PlotStatus
  plotDetails?: string
  purchaseParty?: string
  finalPricePerSqft?: number
  finalTotalPurchasePrice?: number
  notes?: string
  isPublicUse?: boolean
}): Promise<LandPlot> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const ts = nowIso()
  const irr = input.isIrregular === true
  const plot: LandPlot = {
    id: id('plot'),
    projectId: input.projectId,
    plotNumber: input.plotNumber?.trim() || undefined,
    widthFeet: input.widthFeet,
    lengthFeet: input.lengthFeet,
    widthFeet2: irr ? input.widthFeet2 : undefined,
    lengthFeet2: irr ? input.lengthFeet2 : undefined,
    isIrregular: irr,
    calculatedSquareFeet:
      plotCalculatedSqFtFromDimensions({
        isIrregular: irr,
        widthFeet: input.widthFeet,
        lengthFeet: input.lengthFeet,
        widthFeet2: irr ? input.widthFeet2 : undefined,
        lengthFeet2: irr ? input.lengthFeet2 : undefined,
      }) ?? undefined,
    totalSquareFeetOverride: input.totalSquareFeetOverride,
    pricePerSqft: input.pricePerSqft,
    totalPurchasePrice: input.totalPurchasePrice,
    currency: input.currency?.trim() || 'INR',
    isReserved: input.isReserved ?? false,
    status: input.status ?? 'open',
    plotDetails: input.plotDetails?.trim() || undefined,
    purchaseParty: input.purchaseParty?.trim() || undefined,
    finalPricePerSqft: input.finalPricePerSqft,
    finalTotalPurchasePrice: input.finalTotalPurchasePrice,
    notes: input.notes?.trim() || undefined,
    isPublicUse: input.isPublicUse ?? false,
    createdAt: ts,
    updatedAt: ts,
  }
  db.plots.push(plot)
  project.updatedAt = nowIso()
  saveDb(db)
  return plot
}

export async function updatePlot(
  plotId: string,
  projectId: string,
  patch: Partial<{
    plotNumber: string | null
    isIrregular: boolean
    widthFeet: number | null
    lengthFeet: number | null
    widthFeet2: number | null
    lengthFeet2: number | null
    totalSquareFeetOverride: number | null
    pricePerSqft: number
    totalPurchasePrice: number | null
    currency: string
    isReserved: boolean
    status: PlotStatus
    plotDetails: string | null
    purchaseParty: string | null
    finalPricePerSqft: number | null
    finalTotalPurchasePrice: number | null
    notes: string | null
    isPublicUse: boolean
  }>,
): Promise<LandPlot> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  if (patch.plotNumber !== undefined) {
    plot.plotNumber = patch.plotNumber?.trim() || undefined
  }
  if (patch.isIrregular !== undefined) plot.isIrregular = patch.isIrregular
  if (patch.widthFeet !== undefined) plot.widthFeet = patch.widthFeet ?? undefined
  if (patch.lengthFeet !== undefined) plot.lengthFeet = patch.lengthFeet ?? undefined
  if (patch.widthFeet2 !== undefined) plot.widthFeet2 = patch.widthFeet2 ?? undefined
  if (patch.lengthFeet2 !== undefined) plot.lengthFeet2 = patch.lengthFeet2 ?? undefined
  if (patch.totalSquareFeetOverride !== undefined) {
    plot.totalSquareFeetOverride = patch.totalSquareFeetOverride ?? undefined
  }
  if (patch.pricePerSqft !== undefined) plot.pricePerSqft = patch.pricePerSqft
  if (patch.totalPurchasePrice !== undefined) plot.totalPurchasePrice = patch.totalPurchasePrice ?? undefined
  if (patch.currency != null) plot.currency = patch.currency.trim() || 'INR'
  if (patch.isReserved !== undefined) plot.isReserved = patch.isReserved
  if (patch.status != null) plot.status = patch.status
  if (patch.plotDetails !== undefined) {
    plot.plotDetails = patch.plotDetails?.trim() || undefined
  }
  if (patch.purchaseParty !== undefined) {
    plot.purchaseParty = patch.purchaseParty?.trim() || undefined
  }
  if (patch.finalPricePerSqft !== undefined) {
    plot.finalPricePerSqft = patch.finalPricePerSqft ?? undefined
  }
  if (patch.finalTotalPurchasePrice !== undefined) {
    plot.finalTotalPurchasePrice = patch.finalTotalPurchasePrice ?? undefined
  }
  if (patch.notes !== undefined) {
    plot.notes = patch.notes?.trim() || undefined
  }
  if (patch.isPublicUse !== undefined) plot.isPublicUse = patch.isPublicUse
  plot.calculatedSquareFeet =
    plotCalculatedSqFtFromDimensions(plot) ?? undefined
  plot.updatedAt = nowIso()
  proj.updatedAt = nowIso()
  saveDb(db)
  return mockEnrichPlot(db, plot)
}

export async function deletePlot(plotId: string, projectId: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  const dissolved = new Set<string>()
  for (const g of db.plotSaleGroups) {
    if (g.projectId !== projectId || !g.plotIds.includes(plotId)) continue
    const next = g.plotIds.filter((x) => x !== plotId)
    g.plotIds = next
    if (next.length < 2) dissolved.add(g.id)
  }
  db.plotSaleGroups = db.plotSaleGroups.filter((g) => !dissolved.has(g.id))
  db.plots = db.plots.filter((x) => x.id !== plotId)
  db.plotSales = db.plotSales.filter((s) => s.plotId !== plotId)
  db.plotSalePayments = db.plotSalePayments.filter(
    (p) =>
      p.plotId !== plotId && (p.saleGroupId == null || !dissolved.has(p.saleGroupId)),
  )
  db.plotSaleAgentPayments = db.plotSaleAgentPayments.filter(
    (p) =>
      p.plotId !== plotId && (p.saleGroupId == null || !dissolved.has(p.saleGroupId)),
  )
  proj.updatedAt = nowIso()
  saveDb(db)
}

// —— Plot sale & buyer payments ——

function mockPlotSaleFromGroup(g: CombinedPlotSaleGroup, anchorPlotId: string): PlotSale {
  return {
    id: g.id,
    plotId: anchorPlotId,
    purchaserName: g.purchaserName,
    subregistrarRegistrationDate: g.subregistrarRegistrationDate,
    negotiatedFinalPrice: g.negotiatedFinalPrice,
    agentCommissionPercent: g.agentCommissionPercent,
    agentCommissionAmount: g.agentCommissionAmount,
    stampDutyPrice: g.stampDutyPrice,
    agreementPrice: g.agreementPrice,
    currency: g.currency,
    paymentsLocked: g.paymentsLocked === true,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    combinedGroupId: g.id,
    combinedDisplayName: g.displayName,
    combinedPlotIds: [...g.plotIds],
  }
}

function mockPlotPaymentsLocked(db: MockDatabase, projectId: string, plotId: string): boolean {
  const g = mockFindSaleGroup(db, projectId, plotId)
  if (g) return g.paymentsLocked === true
  const s = db.plotSales.find((x) => x.plotId === plotId)
  return s?.paymentsLocked === true
}

export async function getPlotSale(plotId: string, projectId: string): Promise<PlotSale | null> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const g = mockFindSaleGroup(db, projectId, plotId)
  if (g) return mockPlotSaleFromGroup(g, plotId)
  return db.plotSales.find((s) => s.plotId === plotId) ?? null
}

const MOCK_PLOT_SALE_FISCAL_NOTE =
  'Fiscal: sold single-plot sales and combined multi-plot sales (one row per purchase) whose subregistrar registration date is in the range. Payment totals are net of refunds (all buyer payments to date for that sale).'

const MOCK_PLOT_SALE_ACTIVITY_NOTE =
  'Activity: single-plot and combined sales (one row per purchase) with buyer payment lines paid in the range. Payment totals are net of refunds for that window only.'

const MOCK_PLOT_SALE_COMBINED_NOTE =
  ' Combined plot sales appear once per purchase; plot numbers are listed together in the Plot # column.'

function mockReportDateInRange(d: string | undefined, start: string, end: string): boolean {
  if (!d?.trim()) return false
  const x = d.trim().slice(0, 10)
  return x >= start && x <= end
}

function mockNetBuyerPayment(p: PlotSalePayment): number {
  const raw = p.amount ?? 0
  return p.isRefund === true ? -raw : raw
}

function mockAggBuyerPayments(
  db: MockDatabase,
  pred: (p: PlotSalePayment) => boolean,
): Record<string, number> {
  const m: Record<string, number> = {}
  for (const p of db.plotSalePayments) {
    if (!pred(p)) continue
    const mode = p.paymentMode?.trim() || 'Other'
    m[mode] = (m[mode] ?? 0) + mockNetBuyerPayment(p)
  }
  return m
}

export async function getPlotSaleReport(
  projectId: string,
  params: { report: 'fiscal' | 'activity'; startDate: string; endDate: string },
): Promise<PlotSaleReportResponse> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  const startDate = params.startDate.trim().slice(0, 10)
  const endDate = params.endDate.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error('Invalid date range')
  }
  if (startDate > endDate) throw new Error('startDate must be on or before endDate')
  const db = loadDb()
  const { report } = params

  type Base = {
    rowKey: string
    plotNumber: string | null
    purchaserName: string | null
    reg: string | null
    negotiatedFinalPrice: number | null
    currency: string
    groupId: string | null
    isCombined: boolean
  }

  function combinedPlotNumberLabel(g: CombinedPlotSaleGroup): string | null {
    const labels = g.plotIds
      .map((pid) => db.plots.find((p) => p.id === pid)?.plotNumber?.trim())
      .filter((x): x is string => !!x)
    if (labels.length === 0) return null
    return [...new Set(labels)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ')
  }

  let bases: Base[] = []

  if (report === 'fiscal') {
    for (const plot of db.plots) {
      if (plot.projectId !== projectId || plot.status !== 'sold') continue
      if (mockFindSaleGroup(db, projectId, plot.id)) continue
      const s = db.plotSales.find((x) => x.plotId === plot.id)
      if (!mockReportDateInRange(s?.subregistrarRegistrationDate, startDate, endDate)) continue
      bases.push({
        rowKey: plot.id,
        plotNumber: plot.plotNumber?.trim() || null,
        purchaserName: s?.purchaserName?.trim() || null,
        reg: s?.subregistrarRegistrationDate?.trim().slice(0, 10) ?? null,
        negotiatedFinalPrice: s?.negotiatedFinalPrice ?? null,
        currency: (s?.currency || plot.currency || 'INR').trim() || 'INR',
        groupId: null,
        isCombined: false,
      })
    }
    for (const g of db.plotSaleGroups) {
      if (g.projectId !== projectId) continue
      if (!mockReportDateInRange(g.subregistrarRegistrationDate, startDate, endDate)) continue
      const allSold = g.plotIds.every((pid) => {
        const p = db.plots.find((x) => x.id === pid && x.projectId === projectId)
        return p?.status === 'sold'
      })
      if (!allSold) continue
      const plot0 = db.plots.find((p) => p.id === g.plotIds[0])
      bases.push({
        rowKey: g.id,
        plotNumber: combinedPlotNumberLabel(g),
        purchaserName: g.purchaserName?.trim() || null,
        reg: g.subregistrarRegistrationDate?.trim().slice(0, 10) ?? null,
        negotiatedFinalPrice: g.negotiatedFinalPrice ?? null,
        currency: (g.currency || plot0?.currency || 'INR').trim() || 'INR',
        groupId: g.id,
        isCombined: true,
      })
    }
    bases.sort((a, b) => {
      const c = (a.reg ?? '').localeCompare(b.reg ?? '')
      if (c !== 0) return c
      return (a.plotNumber ?? '').localeCompare(b.plotNumber ?? '', undefined, { numeric: true })
    })
  } else {
    const activeGroupIds = new Set<string>()
    const activePlotIds = new Set<string>()
    for (const pay of db.plotSalePayments) {
      const pd = pay.paidDate.slice(0, 10)
      if (pd < startDate || pd > endDate) continue
      if (pay.saleGroupId) {
        const g = db.plotSaleGroups.find((x) => x.id === pay.saleGroupId && x.projectId === projectId)
        if (g) activeGroupIds.add(g.id)
      } else if (pay.plotId) {
        const plot = db.plots.find((p) => p.id === pay.plotId && p.projectId === projectId)
        if (plot && !mockFindSaleGroup(db, projectId, pay.plotId)) {
          activePlotIds.add(pay.plotId)
        }
      }
    }
    for (const gid of activeGroupIds) {
      const g = db.plotSaleGroups.find((x) => x.id === gid && x.projectId === projectId)
      if (!g) continue
      const plot0 = db.plots.find((p) => p.id === g.plotIds[0])
      bases.push({
        rowKey: g.id,
        plotNumber: combinedPlotNumberLabel(g),
        purchaserName: g.purchaserName?.trim() || null,
        reg: g.subregistrarRegistrationDate?.trim().slice(0, 10) ?? null,
        negotiatedFinalPrice: g.negotiatedFinalPrice ?? null,
        currency: (g.currency || plot0?.currency || 'INR').trim() || 'INR',
        groupId: g.id,
        isCombined: true,
      })
    }
    for (const plotId of activePlotIds) {
      const plot = db.plots.find((p) => p.id === plotId && p.projectId === projectId)
      if (!plot) continue
      const s = db.plotSales.find((x) => x.plotId === plotId)
      bases.push({
        rowKey: plotId,
        plotNumber: plot.plotNumber?.trim() || null,
        purchaserName: s?.purchaserName?.trim() || null,
        reg: s?.subregistrarRegistrationDate?.trim().slice(0, 10) ?? null,
        negotiatedFinalPrice: s?.negotiatedFinalPrice ?? null,
        currency: (s?.currency || plot.currency || 'INR').trim() || 'INR',
        groupId: null,
        isCombined: false,
      })
    }
    bases.sort((a, b) =>
      (a.plotNumber ?? '').localeCompare(b.plotNumber ?? '', undefined, { numeric: true }),
    )
  }

  const rows = bases.map((b) => {
    const dateOk = (pd: string) => pd >= startDate && pd <= endDate
    const payMap =
      b.groupId != null
        ? mockAggBuyerPayments(
            db,
            (p) =>
              p.saleGroupId === b.groupId &&
              (report === 'fiscal' ||
                (p.paidDate.trim() !== '' && dateOk(p.paidDate.slice(0, 10)))),
          )
        : mockAggBuyerPayments(
            db,
            (p) =>
              p.plotId === b.rowKey &&
              !p.saleGroupId &&
              (report === 'fiscal' ||
                (p.paidDate.trim() !== '' && dateOk(p.paidDate.slice(0, 10)))),
          )
    return {
      plotId: b.isCombined ? b.groupId! : b.rowKey,
      plotNumber: b.plotNumber,
      purchaserName: b.purchaserName,
      subregistrarRegistrationDate: b.reg,
      negotiatedFinalPrice: b.negotiatedFinalPrice,
      currency: b.currency,
      combinedGroupId: b.groupId,
      isCombinedSale: b.isCombined,
      paymentTotalsByMode: payMap,
    }
  })

  const hasCombined = rows.some((r) => r.isCombinedSale)
  const note =
    (report === 'fiscal' ? MOCK_PLOT_SALE_FISCAL_NOTE : MOCK_PLOT_SALE_ACTIVITY_NOTE) +
    (hasCombined ? MOCK_PLOT_SALE_COMBINED_NOTE : '')

  return {
    report,
    startDate,
    endDate,
    projectId,
    rows,
    note,
  }
}

export async function upsertPlotSale(
  plotId: string,
  projectId: string,
  body: {
    purchaserName?: string | null
    subregistrarRegistrationDate?: string | null
    negotiatedFinalPrice?: number | null
    agentCommissionPercent?: number | null
    agentCommissionAmount?: number | null
    stampDutyPrice?: number | null
    agreementPrice?: number | null
    currency?: string
    paymentsLocked?: boolean
  },
): Promise<PlotSale> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  const ts = nowIso()
  const g = mockFindSaleGroup(db, projectId, plotId)
  if (g) {
    if ('purchaserName' in body) g.purchaserName = body.purchaserName?.trim() || undefined
    if ('subregistrarRegistrationDate' in body)
      g.subregistrarRegistrationDate =
        body.subregistrarRegistrationDate?.trim()?.slice(0, 10) || undefined
    if ('negotiatedFinalPrice' in body) g.negotiatedFinalPrice = body.negotiatedFinalPrice ?? undefined
    if ('agentCommissionPercent' in body) g.agentCommissionPercent = body.agentCommissionPercent ?? undefined
    if ('agentCommissionAmount' in body) g.agentCommissionAmount = body.agentCommissionAmount ?? undefined
    if ('stampDutyPrice' in body) g.stampDutyPrice = body.stampDutyPrice ?? undefined
    if ('agreementPrice' in body) g.agreementPrice = body.agreementPrice ?? undefined
    if ('currency' in body) g.currency = body.currency?.trim() || plot.currency || 'INR'
    if ('paymentsLocked' in body) g.paymentsLocked = Boolean(body.paymentsLocked)
    g.updatedAt = ts
    proj.updatedAt = ts
    saveDb(db)
    return mockPlotSaleFromGroup(g, plotId)
  }
  const idx = db.plotSales.findIndex((s) => s.plotId === plotId)
  if (idx >= 0) {
    const cur = 'currency' in body ? body.currency?.trim() || plot.currency || 'INR' : undefined
    const prev = db.plotSales[idx]
    const row: PlotSale = { ...prev }
    if ('purchaserName' in body) row.purchaserName = body.purchaserName?.trim() || undefined
    if ('subregistrarRegistrationDate' in body)
      row.subregistrarRegistrationDate =
        body.subregistrarRegistrationDate?.trim()?.slice(0, 10) || undefined
    if ('negotiatedFinalPrice' in body) row.negotiatedFinalPrice = body.negotiatedFinalPrice ?? undefined
    if ('agentCommissionPercent' in body) row.agentCommissionPercent = body.agentCommissionPercent ?? undefined
    if ('agentCommissionAmount' in body) row.agentCommissionAmount = body.agentCommissionAmount ?? undefined
    if ('stampDutyPrice' in body) row.stampDutyPrice = body.stampDutyPrice ?? undefined
    if ('agreementPrice' in body) row.agreementPrice = body.agreementPrice ?? undefined
    if ('currency' in body && cur !== undefined) row.currency = cur
    if ('paymentsLocked' in body) row.paymentsLocked = Boolean(body.paymentsLocked)
    row.updatedAt = ts
    db.plotSales[idx] = row
    proj.updatedAt = ts
    saveDb(db)
    return row
  }
  const row: PlotSale = {
    id: id('plotsale'),
    plotId,
    purchaserName:
      'purchaserName' in body ? body.purchaserName?.trim() || undefined : undefined,
    subregistrarRegistrationDate:
      'subregistrarRegistrationDate' in body
        ? body.subregistrarRegistrationDate?.trim()?.slice(0, 10) || undefined
        : undefined,
    negotiatedFinalPrice:
      'negotiatedFinalPrice' in body ? body.negotiatedFinalPrice ?? undefined : undefined,
    agentCommissionPercent:
      'agentCommissionPercent' in body ? body.agentCommissionPercent ?? undefined : undefined,
    agentCommissionAmount:
      'agentCommissionAmount' in body ? body.agentCommissionAmount ?? undefined : undefined,
    stampDutyPrice: 'stampDutyPrice' in body ? body.stampDutyPrice ?? undefined : undefined,
    agreementPrice: 'agreementPrice' in body ? body.agreementPrice ?? undefined : undefined,
    currency:
      'currency' in body
        ? body.currency?.trim() || plot.currency || 'INR'
        : plot.currency || 'INR',
    paymentsLocked: 'paymentsLocked' in body ? Boolean(body.paymentsLocked) : false,
    createdAt: ts,
    updatedAt: ts,
  }
  db.plotSales.push(row)
  proj.updatedAt = ts
  saveDb(db)
  return row
}

export async function listPlotSalePayments(
  plotId: string,
  projectId: string,
): Promise<PlotSalePayment[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const g = mockFindSaleGroup(db, projectId, plotId)
  const list = g
    ? db.plotSalePayments.filter((p) => p.saleGroupId === g.id)
    : db.plotSalePayments.filter((p) => p.plotId === plotId)
  return list.sort(
    (a, b) => b.paidDate.localeCompare(a.paidDate) || b.createdAt.localeCompare(a.createdAt),
  )
}

export async function createPlotSalePayment(
  plotId: string,
  projectId: string,
  input: {
    paymentMode: string
    paidDate: string
    amount?: number | null
    notes?: string | null
    accountId?: string | null
    isRefund?: boolean
  },
): Promise<PlotSalePayment> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  const ts = nowIso()
  if (mockPlotPaymentsLocked(db, projectId, plotId)) {
    throw new Error('Payment transactions are locked for this sale.')
  }
  const g = mockFindSaleGroup(db, projectId, plotId)
  if (input.accountId != null && input.accountId !== '') {
    const acc = db.accounts.find((a) => a.id === input.accountId)
    if (!acc) throw new Error('Unknown account')
  }
  const pay: PlotSalePayment = {
    id: id('plotpay'),
    plotId: g ? undefined : plotId,
    saleGroupId: g?.id,
    paymentMode: input.paymentMode.trim(),
    paidDate: input.paidDate.slice(0, 10),
    amount: input.amount ?? undefined,
    notes: input.notes?.trim() || undefined,
    accountId: input.accountId?.trim() || undefined,
    isRefund: input.isRefund === true,
    createdAt: ts,
    updatedAt: ts,
  }
  db.plotSalePayments.push(pay)
  proj.updatedAt = ts
  saveDb(db)
  return pay
}

function mockPaymentMatchesPlot(
  db: MockDatabase,
  projectId: string,
  plotId: string,
  p: PlotSalePayment | PlotSaleAgentPayment,
): boolean {
  if (p.plotId === plotId) return true
  if (p.saleGroupId == null) return false
  const g = db.plotSaleGroups.find((x) => x.id === p.saleGroupId && x.projectId === projectId)
  return g != null && g.plotIds.includes(plotId)
}

export async function updatePlotSalePayment(
  plotId: string,
  paymentId: string,
  projectId: string,
  patch: Partial<{
    paymentMode: string
    paidDate: string
    amount: number | null
    notes: string | null
    accountId: string | null
    isRefund: boolean
  }>,
): Promise<PlotSalePayment> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  const pay = db.plotSalePayments.find(
    (p) => p.id === paymentId && mockPaymentMatchesPlot(db, projectId, plotId, p),
  )
  if (!pay) throw new Error('Not found')
  if (mockPlotPaymentsLocked(db, projectId, plotId)) {
    throw new Error('Payment transactions are locked for this sale.')
  }
  const ts = nowIso()
  if (patch.paymentMode !== undefined) pay.paymentMode = patch.paymentMode.trim()
  if (patch.paidDate !== undefined) pay.paidDate = patch.paidDate.slice(0, 10)
  if (patch.amount !== undefined) pay.amount = patch.amount ?? undefined
  if (patch.notes !== undefined) pay.notes = patch.notes?.trim() || undefined
  if (patch.isRefund !== undefined) pay.isRefund = patch.isRefund === true
  if (patch.accountId !== undefined) {
    if (patch.accountId != null && patch.accountId !== '') {
      const acc = db.accounts.find((a) => a.id === patch.accountId)
      if (!acc) throw new Error('Unknown account')
      pay.accountId = patch.accountId
    } else {
      pay.accountId = undefined
    }
  }
  pay.updatedAt = ts
  proj.updatedAt = ts
  saveDb(db)
  return pay
}

export async function deletePlotSalePayment(
  plotId: string,
  paymentId: string,
  projectId: string,
): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  if (mockPlotPaymentsLocked(db, projectId, plotId)) {
    throw new Error('Payment transactions are locked for this sale.')
  }
  const before = db.plotSalePayments.length
  db.plotSalePayments = db.plotSalePayments.filter(
    (p) =>
      !(
        p.id === paymentId &&
        mockPaymentMatchesPlot(db, projectId, plotId, p)
      ),
  )
  if (db.plotSalePayments.length === before) throw new Error('Not found')
  proj.updatedAt = nowIso()
  saveDb(db)
}

export async function listPlotSaleAgentPayments(
  plotId: string,
  projectId: string,
): Promise<PlotSaleAgentPayment[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const g = mockFindSaleGroup(db, projectId, plotId)
  const list = g
    ? db.plotSaleAgentPayments.filter((p) => p.saleGroupId === g.id)
    : db.plotSaleAgentPayments.filter((p) => p.plotId === plotId)
  return list.sort(
    (a, b) => b.paidDate.localeCompare(a.paidDate) || b.createdAt.localeCompare(a.createdAt),
  )
}

export async function createPlotSaleAgentPayment(
  plotId: string,
  projectId: string,
  input: {
    paymentMode: string
    paidDate: string
    amount?: number | null
    notes?: string | null
  },
): Promise<PlotSaleAgentPayment> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  if (mockPlotPaymentsLocked(db, projectId, plotId)) {
    throw new Error('Payment transactions are locked for this sale.')
  }
  const ts = nowIso()
  const g = mockFindSaleGroup(db, projectId, plotId)
  const pay: PlotSaleAgentPayment = {
    id: id('plotagpay'),
    plotId: g ? undefined : plotId,
    saleGroupId: g?.id,
    paymentMode: input.paymentMode.trim(),
    paidDate: input.paidDate.slice(0, 10),
    amount: input.amount ?? undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: ts,
    updatedAt: ts,
  }
  db.plotSaleAgentPayments.push(pay)
  proj.updatedAt = ts
  saveDb(db)
  return pay
}

export async function updatePlotSaleAgentPayment(
  plotId: string,
  agentPaymentId: string,
  projectId: string,
  patch: Partial<{
    paymentMode: string
    paidDate: string
    amount: number | null
    notes: string | null
  }>,
): Promise<PlotSaleAgentPayment> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  if (mockPlotPaymentsLocked(db, projectId, plotId)) {
    throw new Error('Payment transactions are locked for this sale.')
  }
  const pay = db.plotSaleAgentPayments.find(
    (p) => p.id === agentPaymentId && mockPaymentMatchesPlot(db, projectId, plotId, p),
  )
  if (!pay) throw new Error('Not found')
  const ts = nowIso()
  if (patch.paymentMode !== undefined) pay.paymentMode = patch.paymentMode.trim()
  if (patch.paidDate !== undefined) pay.paidDate = patch.paidDate.slice(0, 10)
  if (patch.amount !== undefined) pay.amount = patch.amount ?? undefined
  if (patch.notes !== undefined) pay.notes = patch.notes?.trim() || undefined
  pay.updatedAt = ts
  proj.updatedAt = ts
  saveDb(db)
  return pay
}

export async function deletePlotSaleAgentPayment(
  plotId: string,
  agentPaymentId: string,
  projectId: string,
): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  if (mockPlotPaymentsLocked(db, projectId, plotId)) {
    throw new Error('Payment transactions are locked for this sale.')
  }
  const before = db.plotSaleAgentPayments.length
  db.plotSaleAgentPayments = db.plotSaleAgentPayments.filter(
    (p) =>
      !(
        p.id === agentPaymentId &&
        mockPaymentMatchesPlot(db, projectId, plotId, p)
      ),
  )
  if (db.plotSaleAgentPayments.length === before) throw new Error('Not found')
  proj.updatedAt = nowIso()
  saveDb(db)
}

export async function createCombinedPlotSaleGroup(input: {
  projectId: string
  displayName?: string
  plotIds: string[]
  purchaserName?: string | null
  subregistrarRegistrationDate?: string | null
  negotiatedFinalPrice?: number | null
  agentCommissionPercent?: number | null
  agentCommissionAmount?: number | null
  stampDutyPrice?: number | null
  agreementPrice?: number | null
  currency?: string
  paymentsLocked?: boolean
}): Promise<CombinedPlotSaleGroup> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const proj = db.projects.find((p) => p.id === input.projectId)
  if (!proj) throw new Error('Not found')
  const ids = [...new Set(input.plotIds.filter(Boolean))]
  if (ids.length < 2) throw new Error('A combined sale must include at least two plots')
  for (const pid of ids) {
    const pl = db.plots.find((x) => x.id === pid && x.projectId === input.projectId)
    if (!pl) throw new Error('One or more plots are not in this project')
    if (mockFindSaleGroup(db, input.projectId, pid)) {
      throw new Error('A plot is already in another combined sale')
    }
    if (mockPlotHasSoloPayments(db, pid)) {
      throw new Error('Clear per-plot buyer payments on each plot before combining')
    }
    const solo = db.plotSales.find((s) => s.plotId === pid)
    if (solo && mockSubstantivePlotSale(solo)) {
      throw new Error('Remove or clear per-plot sale details on each plot before combining')
    }
  }
  const ts = nowIso()
  const cur = input.currency?.trim() || 'INR'
  const g: CombinedPlotSaleGroup = {
    id: id('plotgrp'),
    projectId: input.projectId,
    displayName: input.displayName?.trim() ?? '',
    plotIds: ids,
    purchaserName: input.purchaserName?.trim() || undefined,
    subregistrarRegistrationDate:
      input.subregistrarRegistrationDate?.trim()?.slice(0, 10) || undefined,
    negotiatedFinalPrice: input.negotiatedFinalPrice ?? undefined,
    agentCommissionPercent: input.agentCommissionPercent ?? undefined,
    agentCommissionAmount: input.agentCommissionAmount ?? undefined,
    stampDutyPrice: input.stampDutyPrice ?? undefined,
    agreementPrice: input.agreementPrice ?? undefined,
    currency: cur,
    paymentsLocked: input.paymentsLocked === true,
    createdAt: ts,
    updatedAt: ts,
  }
  db.plotSaleGroups.push(g)
  for (const pid of ids) {
    db.plotSales = db.plotSales.filter((s) => s.plotId !== pid)
  }
  proj.updatedAt = ts
  saveDb(db)
  return g
}

export async function getCombinedPlotSaleGroup(
  groupId: string,
  projectId: string,
): Promise<CombinedPlotSaleGroup> {
  await delay()
  const db = loadDb()
  const g = db.plotSaleGroups.find((x) => x.id === groupId && x.projectId === projectId)
  if (!g) throw new Error('Not found')
  return g
}

export async function updateCombinedPlotSaleGroup(
  groupId: string,
  projectId: string,
  patch: {
    displayName?: string
    plotIds?: string[]
    purchaserName?: string | null
    subregistrarRegistrationDate?: string | null
    negotiatedFinalPrice?: number | null
    agentCommissionPercent?: number | null
    agentCommissionAmount?: number | null
    stampDutyPrice?: number | null
    agreementPrice?: number | null
    currency?: string
    paymentsLocked?: boolean
  },
): Promise<CombinedPlotSaleGroup> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const g = db.plotSaleGroups.find((x) => x.id === groupId && x.projectId === projectId)
  if (!g) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj) throw new Error('Not found')
  const ts = nowIso()
  if (patch.displayName !== undefined) g.displayName = patch.displayName.trim()
  if (patch.purchaserName !== undefined)
    g.purchaserName = patch.purchaserName?.trim() || undefined
  if (patch.subregistrarRegistrationDate !== undefined)
    g.subregistrarRegistrationDate =
      patch.subregistrarRegistrationDate?.trim()?.slice(0, 10) || undefined
  if (patch.negotiatedFinalPrice !== undefined)
    g.negotiatedFinalPrice = patch.negotiatedFinalPrice ?? undefined
  if (patch.agentCommissionPercent !== undefined)
    g.agentCommissionPercent = patch.agentCommissionPercent ?? undefined
  if (patch.agentCommissionAmount !== undefined)
    g.agentCommissionAmount = patch.agentCommissionAmount ?? undefined
  if (patch.stampDutyPrice !== undefined) g.stampDutyPrice = patch.stampDutyPrice ?? undefined
  if (patch.agreementPrice !== undefined) g.agreementPrice = patch.agreementPrice ?? undefined
  if (patch.currency !== undefined) g.currency = patch.currency.trim() || 'INR'
  if (patch.paymentsLocked !== undefined) g.paymentsLocked = patch.paymentsLocked === true
  if (patch.plotIds !== undefined) {
    const ids = [...new Set(patch.plotIds.filter(Boolean))]
    if (ids.length < 2) throw new Error('A combined sale must include at least two plots')
    const prev = new Set(g.plotIds)
    for (const pid of ids) {
      const pl = db.plots.find((x) => x.id === pid && x.projectId === projectId)
      if (!pl) throw new Error('One or more plots are not in this project')
      if (!prev.has(pid)) {
        const other = db.plotSaleGroups.some(
          (gr) => gr.id !== groupId && gr.plotIds.includes(pid),
        )
        if (other) throw new Error('A plot is already in another combined sale')
        if (mockPlotHasSoloPayments(db, pid)) {
          throw new Error('Clear per-plot buyer payments on each plot before adding')
        }
        const solo = db.plotSales.find((s) => s.plotId === pid)
        if (solo && mockSubstantivePlotSale(solo)) {
          throw new Error('Remove or clear per-plot sale details before adding')
        }
      }
    }
    for (const pid of prev) {
      if (!ids.includes(pid)) {
        /* removed from group */
      }
    }
    g.plotIds = ids
    for (const pid of ids) {
      if (!prev.has(pid)) db.plotSales = db.plotSales.filter((s) => s.plotId !== pid)
    }
  }
  g.updatedAt = ts
  proj.updatedAt = ts
  saveDb(db)
  return g
}

export async function deleteCombinedPlotSaleGroup(
  groupId: string,
  projectId: string,
): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const before = db.plotSaleGroups.length
  db.plotSaleGroups = db.plotSaleGroups.filter(
    (g) => !(g.id === groupId && g.projectId === projectId),
  )
  if (db.plotSaleGroups.length === before) throw new Error('Not found')
  db.plotSalePayments = db.plotSalePayments.filter((p) => p.saleGroupId !== groupId)
  db.plotSaleAgentPayments = db.plotSaleAgentPayments.filter((p) => p.saleGroupId !== groupId)
  const proj = db.projects.find((p) => p.id === projectId)
  if (proj) proj.updatedAt = nowIso()
  saveDb(db)
}

// —— Vendors ——

function normalizeVendor(v: Vendor): Vendor {
  const k = v.vendorKind
  const vendorKind =
    k === 'person' || k === 'government' || k === 'company' ? k : 'company'
  return { ...v, vendorKind }
}

export async function listVendors(projectId: string): Promise<Vendor[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return loadDb()
    .vendors.filter((v) => v.projectId === projectId)
    .map(normalizeVendor)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createVendor(input: {
  projectId: string
  name: string
  vendorKind?: Vendor['vendorKind']
  contactName?: string
  email?: string
  phone?: string
  notes?: string
}): Promise<Vendor> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const vk =
    input.vendorKind === 'person' || input.vendorKind === 'government'
      ? input.vendorKind
      : 'company'
  const v: Vendor = {
    id: id('ven'),
    projectId: input.projectId,
    name: input.name.trim(),
    vendorKind: vk,
    contactName: input.contactName?.trim() || undefined,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  }
  db.vendors.push(v)
  project.updatedAt = nowIso()
  saveDb(db)
  return normalizeVendor(v)
}

export async function updateVendor(
  vendorId: string,
  patch: Partial<
    Pick<Vendor, 'name' | 'vendorKind' | 'contactName' | 'email' | 'phone' | 'notes'>
  >,
  _projectId?: string,
): Promise<Vendor> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const v = db.vendors.find((x) => x.id === vendorId)
  if (!v) throw new Error('Not found')
  if (_projectId && v.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === v.projectId)
  if (!proj) throw new Error('Not found')
  if (!v.vendorKind) v.vendorKind = 'company'
  if (patch.name != null) v.name = patch.name.trim()
  if (patch.vendorKind !== undefined) v.vendorKind = patch.vendorKind
  if (patch.contactName !== undefined)
    v.contactName = patch.contactName?.trim() || undefined
  if (patch.email !== undefined) v.email = patch.email?.trim() || undefined
  if (patch.phone !== undefined) v.phone = patch.phone?.trim() || undefined
  if (patch.notes !== undefined) v.notes = patch.notes?.trim() || undefined
  proj.updatedAt = nowIso()
  saveDb(db)
  return normalizeVendor(v)
}

export async function deleteVendor(vendorId: string, _projectId?: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const v = db.vendors.find((x) => x.id === vendorId)
  if (!v) throw new Error('Not found')
  if (_projectId && v.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === v.projectId)
  if (!proj) throw new Error('Not found')
  const invIds = db.invoices
    .filter((i) => i.vendorId === vendorId)
    .map((i) => i.id)
  db.vendors = db.vendors.filter((x) => x.id !== vendorId)
  db.invoices = db.invoices.filter((i) => i.vendorId !== vendorId)
  db.payments = db.payments.filter(
    (p) => !invIds.includes(p.invoiceId) && p.vendorId !== vendorId,
  )
  db.documents = db.documents.filter((d) => d.vendorId !== vendorId)
  proj.updatedAt = nowIso()
  saveDb(db)
}

// —— Invoices & payments ——

export async function listInvoices(projectId: string): Promise<Invoice[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return loadDb()
    .invoices.filter((i) => i.projectId === projectId)
    .sort((a, b) => b.issuedDate.localeCompare(a.issuedDate))
}

export async function listInvoicesByVendor(projectId: string, vendorId: string): Promise<Invoice[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return loadDb()
    .invoices.filter((i) => i.projectId === projectId && i.vendorId === vendorId)
    .sort((a, b) => b.issuedDate.localeCompare(a.issuedDate))
}

export async function createInvoice(input: {
  projectId: string
  vendorId: string
  invoiceNumber: string
  amount: number
  gstAmount?: number
  currency?: string
  issuedDate: string
  dueDate?: string
  status?: InvoiceStatus
  glAccountId?: string | null
  apGlAccountId?: string | null
  memo?: string | null
}): Promise<Invoice> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const vendor = db.vendors.find(
    (v) => v.id === input.vendorId && v.projectId === input.projectId,
  )
  if (!vendor) throw new Error('Vendor not found')
  const gst = input.gstAmount ?? 0
  const memoTrim =
    input.memo != null && String(input.memo).trim() !== '' ? String(input.memo).trim() : undefined
  const inv: Invoice = {
    id: id('inv'),
    vendorId: input.vendorId,
    projectId: input.projectId,
    invoiceNumber: input.invoiceNumber.trim(),
    amount: input.amount,
    gstAmount: gst,
    totalWithGst: input.amount + gst,
    currency: input.currency ?? 'INR',
    issuedDate: input.issuedDate,
    dueDate: input.dueDate,
    status: input.status ?? 'sent',
    glAccountId: input.glAccountId ?? undefined,
    apGlAccountId: input.apGlAccountId ?? undefined,
    memo: memoTrim,
  }
  db.invoices.push(inv)
  project.updatedAt = nowIso()
  saveDb(db)
  return inv
}

export async function updateInvoice(
  invoiceId: string,
  patch: InvoiceUpdatePatch,
  _projectId?: string,
): Promise<Invoice> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const inv = db.invoices.find((x) => x.id === invoiceId)
  if (!inv) throw new Error('Not found')
  if (_projectId && inv.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === inv.projectId)
  if (!proj) throw new Error('Not found')
  if (patch.vendorId != null) {
    const v = db.vendors.find((x) => x.id === patch.vendorId && x.projectId === inv.projectId)
    if (!v) throw new Error('Vendor not found')
    inv.vendorId = patch.vendorId
    for (const p of db.payments) {
      if (p.invoiceId === inv.id) p.vendorId = patch.vendorId
    }
  }
  if (patch.invoiceNumber != null) inv.invoiceNumber = patch.invoiceNumber.trim()
  if (patch.amount != null) inv.amount = patch.amount
  if (patch.gstAmount !== undefined) inv.gstAmount = patch.gstAmount
  if (patch.currency != null) inv.currency = patch.currency
  if (patch.issuedDate != null) inv.issuedDate = patch.issuedDate
  if (patch.dueDate !== undefined) {
    inv.dueDate = patch.dueDate === null ? undefined : patch.dueDate
  }
  if (patch.status != null) inv.status = patch.status
  if (patch.glAccountId !== undefined) inv.glAccountId = patch.glAccountId ?? undefined
  if (patch.apGlAccountId !== undefined) inv.apGlAccountId = patch.apGlAccountId ?? undefined
  if (patch.memo !== undefined) {
    inv.memo =
      patch.memo != null && String(patch.memo).trim() !== '' ? String(patch.memo).trim() : undefined
  }
  inv.totalWithGst = invoiceTotalWithGst(inv)
  if (patch.amount != null || patch.gstAmount !== undefined) {
    mockRecomputeInvoicePaymentStatus(db, inv.id)
  }
  proj.updatedAt = nowIso()
  saveDb(db)
  return inv
}

export async function deleteInvoice(invoiceId: string, _projectId?: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const inv = db.invoices.find((x) => x.id === invoiceId)
  if (!inv) throw new Error('Not found')
  if (_projectId && inv.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === inv.projectId)
  if (!proj) throw new Error('Not found')
  db.invoices = db.invoices.filter((x) => x.id !== invoiceId)
  db.payments = db.payments.filter((p) => p.invoiceId !== invoiceId)
  db.documents = db.documents.filter((d) => d.invoiceId !== invoiceId)
  proj.updatedAt = nowIso()
  saveDb(db)
}

export async function listPayments(projectId: string): Promise<Payment[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return loadDb()
    .payments.filter((p) => p.projectId === projectId)
    .sort((a, b) => b.paidDate.localeCompare(a.paidDate))
}

export async function listPaymentsByVendor(projectId: string, vendorId: string): Promise<Payment[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return loadDb()
    .payments.filter((p) => p.projectId === projectId && p.vendorId === vendorId)
    .sort((a, b) => b.paidDate.localeCompare(a.paidDate))
}

export async function createPayment(input: {
  projectId: string
  invoiceId: string
  amount: number
  paidDate: string
  method?: string
  reference?: string
  paymentMethod?: 'Cash' | 'Cheque' | 'RTGS' | 'Other'
  isPaymentPartial?: boolean
  paymentSource?: string
  comments?: string
  paymentSourceKind?: Payment['paymentSourceKind']
  sourceAccountId?: string | null
  glAccountId?: string | null
  fromAccountAmount?: number
  fromCashAmount?: number
  fromOtherAmount?: number
  advanceAllocations?: { advanceId: string; amount: number }[]
}): Promise<Payment> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const inv = db.invoices.find(
    (i) => i.id === input.invoiceId && i.projectId === input.projectId,
  )
  if (!inv) throw new Error('Invoice not found')
  const allocs = (input.advanceAllocations ?? []).filter((a) => a.amount > 0)
  let fa = input.fromAccountAmount ?? 0
  let fc = input.fromCashAmount ?? 0
  let fo = input.fromOtherAmount ?? 0
  const advSum = allocs.reduce((s, a) => s + a.amount, 0)
  if (fa === 0 && fc === 0 && fo === 0 && advSum === 0) {
    const kind = input.paymentSourceKind ?? 'other'
    if (kind === 'account') fa = input.amount
    else if (kind === 'cash') fc = input.amount
    else fo = input.amount
  }
  const sumFund = fa + fc + fo + advSum
  if (Math.abs(sumFund - input.amount) > 0.01) {
    throw new Error(`Payment funding (${sumFund}) must equal payment amount (${input.amount})`)
  }
  if (fa > 0 && (input.sourceAccountId == null || String(input.sourceAccountId).trim() === '')) {
    throw new Error('sourceAccountId is required when paying from a bank account')
  }
  const parts = (fa > 0 ? 1 : 0) + (fc > 0 ? 1 : 0) + (fo > 0 ? 1 : 0) + (advSum > 0 ? 1 : 0)
  const psk: Payment['paymentSourceKind'] =
    parts > 1 ? 'mixed' : fa > 0 ? 'account' : fc > 0 ? 'cash' : 'other'
  const pay: Payment = {
    id: id('pay'),
    invoiceId: input.invoiceId,
    vendorId: inv.vendorId,
    projectId: input.projectId,
    amount: input.amount,
    paidDate: input.paidDate,
    method: input.method?.trim() || undefined,
    reference: input.reference?.trim() || undefined,
    paymentMethod: input.paymentMethod ?? 'Other',
    isPaymentPartial: input.isPaymentPartial ?? false,
    paymentSource: input.paymentSource?.trim() || undefined,
    comments: input.comments?.trim() || undefined,
    paymentSourceKind: psk,
    sourceAccountId: input.sourceAccountId ?? undefined,
    glAccountId: input.glAccountId ?? undefined,
    fromAccountAmount: fa,
    fromCashAmount: fc,
    fromOtherAmount: fo,
    advanceAllocations: allocs.length ? allocs : undefined,
  }
  db.payments.push(pay)
  const paidTotal = db.payments
    .filter((p) => p.invoiceId === inv.id)
    .reduce((s, p) => s + p.amount, 0)
  const due = invoiceTotalWithGst(inv)
  if (paidTotal >= due) inv.status = 'paid'
  else if (paidTotal > 0) inv.status = 'partial'
  project.updatedAt = nowIso()
  saveDb(db)
  return pay
}

function mockRecomputeInvoicePaymentStatus(db: MockDatabase, invoiceId: string) {
  const inv = db.invoices.find((i) => i.id === invoiceId)
  if (!inv) return
  const paidTotal = db.payments
    .filter((p) => p.invoiceId === inv.id)
    .reduce((s, p) => s + p.amount, 0)
  const due = invoiceTotalWithGst(inv)
  if (paidTotal <= 0) inv.status = inv.status === 'draft' ? 'draft' : 'sent'
  else if (paidTotal >= due) inv.status = 'paid'
  else inv.status = 'partial'
}

export async function updatePayment(
  paymentId: string,
  _projectId: string,
  patch: Partial<{
    invoiceId: string
    amount: number
    paidDate: string
    method: string | null
    reference: string | null
    paymentMethod: 'Cash' | 'Cheque' | 'RTGS' | 'Other'
    isPaymentPartial: boolean
    paymentSource: string | null
    comments: string | null
    paymentSourceKind: Payment['paymentSourceKind']
    sourceAccountId: string | null
    glAccountId: string | null
    fromAccountAmount: number
    fromCashAmount: number
    fromOtherAmount: number
    advanceAllocations: { advanceId: string; amount: number }[]
  }>,
): Promise<Payment> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const pay = db.payments.find((x) => x.id === paymentId)
  if (!pay) throw new Error('Not found')
  if (_projectId && pay.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === pay.projectId)
  if (!proj) throw new Error('Not found')

  const oldInvoiceId = pay.invoiceId
  let invoicesToRecompute = new Set<string>([oldInvoiceId])

  if (patch.invoiceId !== undefined) {
    const inv = db.invoices.find((i) => i.id === patch.invoiceId && i.projectId === pay.projectId)
    if (!inv) throw new Error('Invoice not found')
    pay.invoiceId = patch.invoiceId
    pay.vendorId = inv.vendorId
    invoicesToRecompute.add(patch.invoiceId)
  }
  if (patch.amount !== undefined) pay.amount = patch.amount
  if (patch.paidDate !== undefined) pay.paidDate = patch.paidDate
  if (patch.method !== undefined) pay.method = patch.method ?? undefined
  if (patch.reference !== undefined) pay.reference = patch.reference ?? undefined
  if (patch.paymentMethod !== undefined) pay.paymentMethod = patch.paymentMethod
  if (patch.isPaymentPartial !== undefined) pay.isPaymentPartial = patch.isPaymentPartial
  if (patch.paymentSource !== undefined) pay.paymentSource = patch.paymentSource ?? undefined
  if (patch.comments !== undefined) pay.comments = patch.comments ?? undefined
  if (patch.paymentSourceKind !== undefined) pay.paymentSourceKind = patch.paymentSourceKind
  if (patch.sourceAccountId !== undefined) pay.sourceAccountId = patch.sourceAccountId ?? undefined
  if (patch.glAccountId !== undefined) pay.glAccountId = patch.glAccountId ?? undefined
  if (patch.fromAccountAmount !== undefined) pay.fromAccountAmount = patch.fromAccountAmount
  if (patch.fromCashAmount !== undefined) pay.fromCashAmount = patch.fromCashAmount
  if (patch.fromOtherAmount !== undefined) pay.fromOtherAmount = patch.fromOtherAmount
  if (patch.advanceAllocations !== undefined) {
    pay.advanceAllocations = patch.advanceAllocations.filter((a) => a.amount > 0)
    if (pay.advanceAllocations.length === 0) delete pay.advanceAllocations
  }

  for (const iid of invoicesToRecompute) {
    mockRecomputeInvoicePaymentStatus(db, iid)
  }
  proj.updatedAt = nowIso()
  saveDb(db)
  return pay
}

export async function deletePayment(paymentId: string, _projectId?: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const pay = db.payments.find((x) => x.id === paymentId)
  if (!pay) throw new Error('Not found')
  if (_projectId && pay.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === pay.projectId)
  if (!proj) throw new Error('Not found')
  const inv = db.invoices.find((i) => i.id === pay.invoiceId)
  db.payments = db.payments.filter((x) => x.id !== paymentId)
  db.accountTransactions = db.accountTransactions.map((t) =>
    t.paymentId === paymentId ? { ...t, paymentId: undefined } : t,
  )
  if (inv) {
    const paidTotal = db.payments
      .filter((p) => p.invoiceId === inv.id)
      .reduce((s, p) => s + p.amount, 0)
    const due = invoiceTotalWithGst(inv)
    if (paidTotal <= 0) inv.status = inv.status === 'draft' ? 'draft' : 'sent'
    else if (paidTotal >= due) inv.status = 'paid'
    else inv.status = 'partial'
  }
  db.documents = db.documents.filter((d) => d.paymentId !== paymentId)
  proj.updatedAt = nowIso()
  saveDb(db)
}

// —— Ledger accounts (system-wide in mock store) ——

export async function listAccounts(): Promise<Account[]> {
  await delay()
  getUserIdOrThrow()
  return loadDb()
    .accounts.slice()
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
}

export async function createAccount(input: {
  kind: 'bank' | 'cash'
  name: string
  currency?: string
  accountLocation?: string
  projectId?: string
}): Promise<Account> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  let projectId: string | undefined = input.projectId
  if (projectId) {
    const project = db.projects.find((p) => p.id === projectId)
    if (!project) throw new Error('Invalid project')
  }
  const acc: Account = {
    id: id('acc'),
    projectId,
    kind: input.kind,
    name: input.name.trim(),
    accountLocation: input.accountLocation?.trim() || undefined,
    currency: input.currency?.trim() || 'INR',
    createdAt: nowIso(),
  }
  db.accounts.push(acc)
  if (projectId) {
    const proj = db.projects.find((p) => p.id === projectId)
    if (proj) proj.updatedAt = nowIso()
  }
  saveDb(db)
  return acc
}

export async function updateAccount(
  accountId: string,
  patch: Partial<Pick<Account, 'kind' | 'name' | 'currency' | 'accountLocation' | 'projectId'>>,
): Promise<Account> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const acc = db.accounts.find((x) => x.id === accountId)
  if (!acc) throw new Error('Not found')
  if (patch.projectId !== undefined) {
    if (patch.projectId === null || patch.projectId === '') {
      acc.projectId = undefined
    } else {
      const project = db.projects.find((p) => p.id === patch.projectId)
      if (!project) throw new Error('Invalid project')
      acc.projectId = patch.projectId
    }
  }
  if (patch.kind != null) acc.kind = patch.kind
  if (patch.name != null) acc.name = patch.name.trim()
  if (patch.currency != null) acc.currency = patch.currency.trim()
  if (patch.accountLocation !== undefined)
    acc.accountLocation = patch.accountLocation?.trim() || undefined
  if (acc.projectId) {
    const proj = db.projects.find((p) => p.id === acc.projectId)
    if (proj) proj.updatedAt = nowIso()
  }
  saveDb(db)
  return acc
}

export async function deleteAccount(accountId: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const acc = db.accounts.find((x) => x.id === accountId)
  if (!acc) throw new Error('Not found')
  db.accounts = db.accounts.filter((x) => x.id !== accountId)
  db.accountTransactions = db.accountTransactions.filter((t) => t.accountId !== accountId)
  db.accountFixedDeposits = db.accountFixedDeposits.filter((d) => d.accountId !== accountId)
  if (acc.projectId) {
    const proj = db.projects.find((p) => p.id === acc.projectId)
    if (proj) proj.updatedAt = nowIso()
  }
  saveDb(db)
}

// —— Account fixed deposits / investment certificates ——

export async function listAccountFixedDeposits(accountId: string): Promise<AccountFixedDeposit[]> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  if (!db.accounts.some((a) => a.id === accountId)) throw new Error('Not found')
  return db.accountFixedDeposits
    .filter((d) => d.accountId === accountId)
    .sort(
      (a, b) =>
        a.maturityDate.localeCompare(b.maturityDate) ||
        a.certificateNumber.localeCompare(b.certificateNumber),
    )
    .map((row) => enrichAccountFixedDeposit(row))
}

export async function createAccountFixedDeposit(input: {
  accountId: string
  certificateNumber: string
  effectiveDate: string
  principalAmount: number
  annualRatePercent: number
  maturityValue: number
  maturityDate: string
  status?: AccountFixedDepositStatus
  notes?: string
}): Promise<AccountFixedDeposit> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  if (!db.accounts.some((a) => a.id === input.accountId)) throw new Error('Not found')
  const cn = input.certificateNumber.trim()
  if (db.accountFixedDeposits.some((d) => d.accountId === input.accountId && d.certificateNumber === cn)) {
    throw new Error('Certificate number already exists for this account')
  }
  if (input.maturityDate < input.effectiveDate) throw new Error('Maturity must be on or after effective date')
  const now = nowIso()
  const row = {
    id: id('fd'),
    accountId: input.accountId,
    certificateNumber: cn,
    effectiveDate: input.effectiveDate.slice(0, 10),
    principalAmount: input.principalAmount,
    annualRatePercent: input.annualRatePercent,
    maturityValue: input.maturityValue,
    maturityDate: input.maturityDate.slice(0, 10),
    status: input.status ?? 'active',
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
  db.accountFixedDeposits.push(row)
  saveDb(db)
  return enrichAccountFixedDeposit(row)
}

export async function updateAccountFixedDeposit(
  depositId: string,
  accountId: string,
  patch: Partial<{
    certificateNumber: string
    effectiveDate: string
    principalAmount: number
    annualRatePercent: number
    maturityValue: number
    maturityDate: string
    status: AccountFixedDepositStatus
    notes: string | null
  }>,
): Promise<AccountFixedDeposit> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const idx = db.accountFixedDeposits.findIndex((d) => d.id === depositId && d.accountId === accountId)
  if (idx < 0) throw new Error('Not found')
  const cur = db.accountFixedDeposits[idx]
  const next = { ...cur, updatedAt: nowIso() }
  if (patch.certificateNumber !== undefined) {
    const n = patch.certificateNumber.trim()
    if (
      n !== cur.certificateNumber &&
      db.accountFixedDeposits.some((d) => d.accountId === accountId && d.certificateNumber === n)
    ) {
      throw new Error('Certificate number already exists for this account')
    }
    next.certificateNumber = n
  }
  if (patch.effectiveDate !== undefined) next.effectiveDate = patch.effectiveDate.slice(0, 10)
  if (patch.principalAmount !== undefined) next.principalAmount = patch.principalAmount
  if (patch.annualRatePercent !== undefined) next.annualRatePercent = patch.annualRatePercent
  if (patch.maturityValue !== undefined) next.maturityValue = patch.maturityValue
  if (patch.maturityDate !== undefined) next.maturityDate = patch.maturityDate.slice(0, 10)
  if (patch.status !== undefined) next.status = patch.status
  if (patch.notes !== undefined) next.notes = patch.notes?.trim() || undefined
  if (next.maturityDate < next.effectiveDate) throw new Error('Maturity must be on or after effective date')
  db.accountFixedDeposits[idx] = next
  saveDb(db)
  return enrichAccountFixedDeposit(next)
}

export async function deleteAccountFixedDeposit(depositId: string, accountId: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const before = db.accountFixedDeposits.length
  db.accountFixedDeposits = db.accountFixedDeposits.filter(
    (d) => !(d.id === depositId && d.accountId === accountId),
  )
  if (db.accountFixedDeposits.length === before) throw new Error('Not found')
  saveDb(db)
}

function matchesTransactionFilters(
  t: AccountTransaction,
  filters: AccountTransactionListFilters | undefined,
): boolean {
  if (!filters) return true
  if (filters.occurredOnFrom?.trim()) {
    const from = filters.occurredOnFrom.trim()
    if (t.occurredOn.slice(0, 10) < from) return false
  }
  if (filters.occurredOnTo?.trim()) {
    const to = filters.occurredOnTo.trim()
    if (t.occurredOn.slice(0, 10) > to) return false
  }
  if (filters.descriptionContains?.trim()) {
    const q = filters.descriptionContains.trim().toLowerCase()
    if (!(t.description ?? '').toLowerCase().includes(q)) return false
  }
  if (filters.bankMemoContains?.trim()) {
    const q = filters.bankMemoContains.trim().toLowerCase()
    if (!(t.bankMemo ?? '').toLowerCase().includes(q)) return false
  }
  if (filters.transactionCategoryContains?.trim()) {
    const q = filters.transactionCategoryContains.trim().toLowerCase()
    if (!(t.transactionCategory ?? '').toLowerCase().includes(q)) return false
  }
  if (filters.projectId?.trim()) {
    const pid = filters.projectId.trim()
    if (t.projectId !== pid) return false
  }
  return true
}

export async function listAccountTransactions(
  accountId: string,
  filters?: AccountTransactionListFilters,
): Promise<AccountTransaction[]> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const acc = db.accounts.find((a) => a.id === accountId)
  if (!acc) throw new Error('Not found')
  return db.accountTransactions
    .filter((t) => t.accountId === accountId)
    .filter((t) => matchesTransactionFilters(t, filters))
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt))
    .map((t) => ({
      ...t,
      plotNumberLabels: plotNumberLabelsFromIds(t.plotIds, db.plots),
    }))
}

export async function createAccountTransaction(input: {
  accountId: string
  amount: number
  entryType: 'debit' | 'credit'
  description?: string
  bankMemo?: string
  transactionCategory?: string
  plotIds?: string[]
  occurredOn: string
  paymentId?: string
  projectId?: string
}): Promise<AccountTransaction> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const acc = db.accounts.find((a) => a.id === input.accountId)
  if (!acc) throw new Error('Account not found')

  let txnProjectId: string | undefined = input.projectId
  if (input.paymentId) {
    const pay = db.payments.find((p) => p.id === input.paymentId)
    if (!pay) throw new Error('Payment not found')
    const proj = db.projects.find((p) => p.id === pay.projectId)
    if (!proj) throw new Error('Payment not found')
    txnProjectId = pay.projectId
    if (db.accountTransactions.some((t) => t.paymentId === input.paymentId)) {
      throw new Error('A transaction is already linked to this payment')
    }
  } else if (txnProjectId) {
    const project = db.projects.find((p) => p.id === txnProjectId)
    if (!project) throw new Error('Invalid project')
  }

  const tx: AccountTransaction = {
    id: id('atx'),
    projectId: txnProjectId,
    accountId: input.accountId,
    amount: input.amount,
    entryType: input.entryType,
    description: input.description?.trim() || undefined,
    bankMemo: input.bankMemo?.trim() || undefined,
    transactionCategory: input.transactionCategory?.trim() || undefined,
    plotIds: input.plotIds?.slice() ?? undefined,
    occurredOn: input.occurredOn,
    paymentId: input.paymentId,
    createdAt: nowIso(),
  }
  db.accountTransactions.push(tx)
  if (txnProjectId) {
    const proj = db.projects.find((p) => p.id === txnProjectId)
    if (proj) proj.updatedAt = nowIso()
  }
  saveDb(db)
  return {
    ...tx,
    plotNumberLabels: plotNumberLabelsFromIds(tx.plotIds, db.plots),
  }
}

export async function updateAccountTransaction(
  transactionId: string,
  accountId: string,
  input: {
    amount: number
    entryType: 'debit' | 'credit'
    description?: string
    bankMemo?: string
    transactionCategory?: string
    plotIds?: string[]
    occurredOn: string
    paymentId?: string
    projectId?: string
  },
): Promise<AccountTransaction> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const acc = db.accounts.find((a) => a.id === accountId)
  if (!acc) throw new Error('Account not found')
  const idx = db.accountTransactions.findIndex((x) => x.id === transactionId && x.accountId === accountId)
  if (idx < 0) throw new Error('Not found')

  let txnProjectId: string | undefined = input.projectId
  if (input.paymentId) {
    const pay = db.payments.find((p) => p.id === input.paymentId)
    if (!pay) throw new Error('Payment not found')
    const proj = db.projects.find((p) => p.id === pay.projectId)
    if (!proj) throw new Error('Payment not found')
    txnProjectId = pay.projectId
    if (
      db.accountTransactions.some(
        (t) => t.paymentId === input.paymentId && t.id !== transactionId,
      )
    ) {
      throw new Error('A transaction is already linked to this payment')
    }
  } else if (txnProjectId) {
    const project = db.projects.find((p) => p.id === txnProjectId)
    if (!project) throw new Error('Invalid project')
  }

  const prev = db.accountTransactions[idx]
  const prevProjectId = prev.projectId

  const next: AccountTransaction = {
    ...prev,
    projectId: txnProjectId,
    amount: input.amount,
    entryType: input.entryType,
    description: input.description?.trim() || undefined,
    bankMemo: input.bankMemo?.trim() || undefined,
    transactionCategory: input.transactionCategory?.trim() || undefined,
    plotIds: input.plotIds?.slice() ?? undefined,
    occurredOn: input.occurredOn,
    paymentId: input.paymentId,
  }
  db.accountTransactions[idx] = next

  const touch = (pid: string | undefined) => {
    if (!pid) return
    const proj = db.projects.find((p) => p.id === pid)
    if (proj) proj.updatedAt = nowIso()
  }
  if (prevProjectId && prevProjectId !== txnProjectId) touch(prevProjectId)
  if (txnProjectId && txnProjectId !== prevProjectId) touch(txnProjectId)

  saveDb(db)
  return {
    ...next,
    plotNumberLabels: plotNumberLabelsFromIds(next.plotIds, db.plots),
  }
}

export async function listAccountTransactionCategories(): Promise<string[]> {
  await delay(50)
  getUserIdOrThrow()
  const db = loadDb()
  const cats = new Set<string>()
  db.accountTransactions.forEach((t) => {
    const c = t.transactionCategory?.trim()
    if (c) cats.add(c)
  })
  return Array.from(cats).sort((a, b) => a.localeCompare(b))
}

export async function deleteAccountTransaction(
  transactionId: string,
  accountId: string,
): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const acc = db.accounts.find((a) => a.id === accountId)
  if (!acc) throw new Error('Not found')
  const tx = db.accountTransactions.find((x) => x.id === transactionId && x.accountId === accountId)
  if (!tx) throw new Error('Not found')
  db.accountTransactions = db.accountTransactions.filter((x) => x.id !== transactionId)
  if (tx.projectId) {
    const proj = db.projects.find((p) => p.id === tx.projectId)
    if (proj) proj.updatedAt = nowIso()
  }
  saveDb(db)
}

// —— Documents ——

const MAX_MOCK_BYTES = 450 * 1024

export async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return loadDb()
    .documents.filter((d) => d.projectId === projectId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

export async function uploadDocument(input: {
  projectId: string
  file: File
  kind: DocumentKind
  vendorId?: string
  invoiceId?: string
  paymentId?: string
}): Promise<ProjectDocument> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  if (input.file.size > MAX_MOCK_BYTES) {
    throw new Error(
      `File too large for mock storage (max ${Math.round(MAX_MOCK_BYTES / 1024)} KB).`,
    )
  }
  const dataUrl = await readFileAsDataUrl(input.file)
  const db = loadDb()
  const doc: ProjectDocument = {
    id: id('doc'),
    projectId: input.projectId,
    vendorId: input.vendorId,
    invoiceId: input.invoiceId,
    paymentId: input.paymentId,
    kind: input.kind,
    fileName: input.file.name,
    mimeType: input.file.type || 'application/octet-stream',
    sizeBytes: input.file.size,
    uploadedAt: nowIso(),
    dataUrl,
  }
  db.documents.push(doc)
  project.updatedAt = nowIso()
  saveDb(db)
  return doc
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Read failed'))
    r.readAsDataURL(file)
  })
}

export async function deleteDocument(documentId: string, _projectId?: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const db = loadDb()
  const d = db.documents.find((x) => x.id === documentId)
  if (!d) throw new Error('Not found')
  if (_projectId && d.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === d.projectId)
  if (!proj) throw new Error('Not found')
  db.documents = db.documents.filter((x) => x.id !== documentId)
  proj.updatedAt = nowIso()
  saveDb(db)
}

// —— Report aggregates (client-side from same mock data) ——

export async function getProjectReport(projectId: string): Promise<ProjectReport> {
  await delay()
  const project = await getProject(projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const invoices = db.invoices.filter((i) => i.projectId === projectId)
  const payments = db.payments.filter((p) => p.projectId === projectId)
  const vendors = db.vendors.filter((v) => v.projectId === projectId)
  const phases = db.phases.filter((p) => p.projectId === projectId)
  const totalInvoiced = invoices.reduce((s, i) => s + invoiceTotalWithGst(i), 0)
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const byVendor = vendors.map((v) => {
    const inv = invoices.filter((i) => i.vendorId === v.id)
    const pay = payments.filter((p) => p.vendorId === v.id)
    return {
      vendorId: v.id,
      vendorName: v.name,
      invoiced: inv.reduce((s, i) => s + invoiceTotalWithGst(i), 0),
      paid: pay.reduce((s, p) => s + p.amount, 0),
    }
  })
  return {
    project,
    totalInvoiced,
    totalPaid,
    outstanding: Math.max(0, totalInvoiced - totalPaid),
    byVendor,
    byPhase: phases
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((p) => ({
        phaseId: p.id,
        phaseName: p.name,
        status: p.status,
      })),
    invoiceCount: invoices.length,
    paymentCount: payments.length,
  }
}

// —— GL & vendor payment tracking (mock: chart seed only; project flows need real API + migration 027) ——

const MOCK_GL_CATEGORIES: GlCategory[] = [
  { id: 'b1000001-0000-4000-8000-000000000001', code: 'ASSETS', name: 'Assets', sortOrder: 10 },
  { id: 'b1000002-0000-4000-8000-000000000001', code: 'LIABILITIES', name: 'Liabilities', sortOrder: 20 },
  { id: 'b1000003-0000-4000-8000-000000000001', code: 'EQUITY', name: 'Equity', sortOrder: 30 },
  { id: 'b1000004-0000-4000-8000-000000000001', code: 'INCOME', name: 'Income', sortOrder: 40 },
  { id: 'b1000005-0000-4000-8000-000000000001', code: 'COGS', name: 'Cost of goods sold', sortOrder: 50 },
  { id: 'b1000006-0000-4000-8000-000000000001', code: 'EXPENSES', name: 'Expenses', sortOrder: 60 },
  { id: 'b1000009-0000-4000-8000-000000000001', code: 'TAXES', name: 'Taxes', sortOrder: 90 },
]

const MOCK_GL_SUBCATEGORIES: GlSubcategory[] = []

const MOCK_GL_ACCOUNTS: GlAccount[] = [
  {
    id: 'a6006010-0000-4000-8000-000000000001',
    glCategoryId: 'b1000006-0000-4000-8000-000000000001',
    categoryCode: 'EXPENSES',
    categoryName: 'Expenses',
    code: '6010',
    name: 'Subcontractors & job costs',
    isActive: true,
  },
  {
    id: 'a1001020-0000-4000-8000-000000000001',
    glCategoryId: 'b1000001-0000-4000-8000-000000000001',
    categoryCode: 'ASSETS',
    categoryName: 'Assets',
    code: '1020',
    name: 'Bank payment clearing',
    isActive: true,
  },
  {
    id: 'a1001350-0000-4000-8000-000000000001',
    glCategoryId: 'b1000001-0000-4000-8000-000000000001',
    categoryCode: 'ASSETS',
    categoryName: 'Assets',
    code: '1350',
    name: 'Vendor advances (prepaid)',
    isActive: true,
  },
  {
    id: 'a2002010-0000-4000-8000-000000000001',
    glCategoryId: 'b1000002-0000-4000-8000-000000000001',
    categoryCode: 'LIABILITIES',
    categoryName: 'Liabilities',
    code: '2010',
    name: 'Accounts payable',
    isActive: true,
  },
]

/** Per-project GL lines in mock mode (manual journals only). */
const MOCK_PROJECT_GL_ENTRIES = new Map<string, GeneralLedgerEntry[]>()

function mockGlBucket(projectId: string): GeneralLedgerEntry[] {
  let list = MOCK_PROJECT_GL_ENTRIES.get(projectId)
  if (!list) {
    list = []
    MOCK_PROJECT_GL_ENTRIES.set(projectId, list)
  }
  return list
}

function mockSortGlEntries(rows: GeneralLedgerEntry[]): GeneralLedgerEntry[] {
  return [...rows].sort((a, b) => {
    const dc = b.entryDate.localeCompare(a.entryDate)
    if (dc !== 0) return dc
    const sc = (a.sourceId ?? '').localeCompare(b.sourceId ?? '')
    if (sc !== 0) return sc
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
  })
}

const MOCK_GL_EPS = 0.01

export async function listGlCategories(): Promise<GlCategory[]> {
  await delay()
  return MOCK_GL_CATEGORIES.slice()
}

export async function listGlSubcategories(opts?: { glCategoryId?: string }): Promise<GlSubcategory[]> {
  await delay()
  let list = MOCK_GL_SUBCATEGORIES.slice()
  if (opts?.glCategoryId) list = list.filter((s) => s.glCategoryId === opts.glCategoryId)
  return list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export async function createGlSubcategory(input: {
  glCategoryId: string
  code: string
  name: string
  sortOrder?: number
}): Promise<GlSubcategory> {
  await delay()
  getUserIdOrThrow()
  const cat = MOCK_GL_CATEGORIES.find((c) => c.id === input.glCategoryId)
  if (!cat) throw new Error('Category not found')
  const dup = MOCK_GL_SUBCATEGORIES.some(
    (s) => s.glCategoryId === input.glCategoryId && s.code === input.code.trim(),
  )
  if (dup) throw new Error('Subcategory code already exists for this category')
  const row: GlSubcategory = {
    id: id('gls'),
    glCategoryId: input.glCategoryId,
    code: input.code.trim(),
    name: input.name.trim(),
    sortOrder: input.sortOrder ?? 0,
  }
  MOCK_GL_SUBCATEGORIES.push(row)
  return row
}

export async function updateGlSubcategory(
  subcategoryId: string,
  patch: Partial<{ code: string; name: string; sortOrder: number }>,
): Promise<GlSubcategory> {
  await delay()
  getUserIdOrThrow()
  const row = MOCK_GL_SUBCATEGORIES.find((s) => s.id === subcategoryId)
  if (!row) throw new Error('Not found')
  if (patch.code != null) row.code = patch.code.trim()
  if (patch.name != null) row.name = patch.name.trim()
  if (patch.sortOrder != null) row.sortOrder = patch.sortOrder
  return { ...row }
}

export async function deleteGlSubcategory(subcategoryId: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  const i = MOCK_GL_SUBCATEGORIES.findIndex((s) => s.id === subcategoryId)
  if (i < 0) throw new Error('Not found')
  MOCK_GL_SUBCATEGORIES.splice(i, 1)
  for (const a of MOCK_GL_ACCOUNTS) {
    if (a.glSubcategoryId === subcategoryId) {
      delete a.glSubcategoryId
      delete a.subcategoryCode
      delete a.subcategoryName
    }
  }
}

export async function listGlAccounts(opts?: { includeInactive?: boolean }): Promise<GlAccount[]> {
  await delay()
  const list = MOCK_GL_ACCOUNTS.slice()
  if (opts?.includeInactive) return list.sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''))
  return list.filter((a) => a.isActive !== false).sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''))
}

export async function createGlCategory(input: {
  code: string
  name: string
  sortOrder?: number
}): Promise<GlCategory> {
  await delay()
  getUserIdOrThrow()
  const row: GlCategory = {
    id: id('glc'),
    code: input.code.trim(),
    name: input.name.trim(),
    sortOrder: input.sortOrder ?? 0,
  }
  MOCK_GL_CATEGORIES.push(row)
  return row
}

export async function updateGlCategory(
  categoryId: string,
  patch: Partial<{ code: string; name: string; sortOrder: number }>,
): Promise<GlCategory> {
  await delay()
  getUserIdOrThrow()
  const row = MOCK_GL_CATEGORIES.find((c) => c.id === categoryId)
  if (!row) throw new Error('Not found')
  if (patch.code != null) row.code = patch.code.trim()
  if (patch.name != null) row.name = patch.name.trim()
  if (patch.sortOrder != null) row.sortOrder = patch.sortOrder
  return { ...row }
}

export async function deleteGlCategory(categoryId: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  if (MOCK_GL_ACCOUNTS.some((a) => a.glCategoryId === categoryId)) {
    throw new Error('Cannot delete a GL category that still has accounts')
  }
  if (MOCK_GL_SUBCATEGORIES.some((s) => s.glCategoryId === categoryId)) {
    const keep = MOCK_GL_SUBCATEGORIES.filter((s) => s.glCategoryId !== categoryId)
    MOCK_GL_SUBCATEGORIES.length = 0
    MOCK_GL_SUBCATEGORIES.push(...keep)
  }
  const i = MOCK_GL_CATEGORIES.findIndex((c) => c.id === categoryId)
  if (i < 0) throw new Error('Not found')
  MOCK_GL_CATEGORIES.splice(i, 1)
}

export async function createGlAccount(input: {
  glCategoryId: string
  glSubcategoryId?: string
  code: string
  name: string
  isActive?: boolean
}): Promise<GlAccount> {
  await delay()
  getUserIdOrThrow()
  const cat = MOCK_GL_CATEGORIES.find((c) => c.id === input.glCategoryId)
  if (!cat) throw new Error('Category not found')
  let sub: GlSubcategory | undefined
  if (input.glSubcategoryId) {
    sub = MOCK_GL_SUBCATEGORIES.find(
      (s) => s.id === input.glSubcategoryId && s.glCategoryId === input.glCategoryId,
    )
    if (!sub) throw new Error('Subcategory not found or wrong category')
  }
  const row: GlAccount = {
    id: id('gla'),
    glCategoryId: input.glCategoryId,
    categoryCode: cat.code,
    categoryName: cat.name,
    code: input.code.trim(),
    name: input.name.trim(),
    isActive: input.isActive !== false,
  }
  if (sub) {
    row.glSubcategoryId = sub.id
    row.subcategoryCode = sub.code
    row.subcategoryName = sub.name
  }
  MOCK_GL_ACCOUNTS.push(row)
  return row
}

export async function updateGlAccount(
  accountId: string,
  patch: Partial<{
    glCategoryId: string
    glSubcategoryId: string | null
    code: string
    name: string
    isActive: boolean
  }>,
): Promise<GlAccount> {
  await delay()
  getUserIdOrThrow()
  const row = MOCK_GL_ACCOUNTS.find((a) => a.id === accountId)
  if (!row) throw new Error('Not found')
  if (patch.glCategoryId != null) {
    const cat = MOCK_GL_CATEGORIES.find((c) => c.id === patch.glCategoryId)
    if (!cat) throw new Error('Category not found')
    row.glCategoryId = patch.glCategoryId
    row.categoryCode = cat.code
    row.categoryName = cat.name
    if (
      row.glSubcategoryId &&
      !MOCK_GL_SUBCATEGORIES.some((s) => s.id === row.glSubcategoryId && s.glCategoryId === patch.glCategoryId)
    ) {
      delete row.glSubcategoryId
      delete row.subcategoryCode
      delete row.subcategoryName
    }
  }
  if (patch.glSubcategoryId !== undefined) {
    if (patch.glSubcategoryId === null) {
      delete row.glSubcategoryId
      delete row.subcategoryCode
      delete row.subcategoryName
    } else {
      const sub = MOCK_GL_SUBCATEGORIES.find(
        (s) => s.id === patch.glSubcategoryId && s.glCategoryId === row.glCategoryId,
      )
      if (!sub) throw new Error('Subcategory not found or wrong category')
      row.glSubcategoryId = sub.id
      row.subcategoryCode = sub.code
      row.subcategoryName = sub.name
    }
  }
  if (patch.code != null) row.code = patch.code.trim()
  if (patch.name != null) row.name = patch.name.trim()
  if (patch.isActive !== undefined) row.isActive = patch.isActive
  return { ...row }
}

export async function listGeneralLedgerEntries(
  projectId: string,
  opts?: { startDate?: string; endDate?: string; sourceKind?: string; sourceId?: string },
): Promise<GeneralLedgerEntry[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  const start = opts?.startDate?.slice(0, 10)
  const end = opts?.endDate?.slice(0, 10)
  const sk = opts?.sourceKind?.trim()
  const sid = opts?.sourceId?.trim()
  let rows = mockGlBucket(projectId).slice()
  if (start) rows = rows.filter((r) => r.entryDate >= start)
  if (end) rows = rows.filter((r) => r.entryDate <= end)
  if (sk && sid) rows = rows.filter((r) => r.sourceKind === sk && r.sourceId === sid)
  return mockSortGlEntries(rows)
}

export async function createManualJournal(
  projectId: string,
  body: {
    entryDate: string
    lines: {
      glAccountId: string
      debit: number
      credit: number
      memo?: string | null
      userNotes?: string | null
    }[]
  },
): Promise<GeneralLedgerEntry[]> {
  await delay()
  getUserIdOrThrow()
  if (!(await getProject(projectId))) throw new Error('Not found')
  const lines = body.lines ?? []
  if (lines.length < 2) throw new Error('A manual journal needs at least two lines')
  let sumDr = 0
  let sumCr = 0
  const normalized: typeof lines = []
  for (const ln of lines) {
    const d = Number(ln.debit) || 0
    const c = Number(ln.credit) || 0
    if (d < 0 || c < 0) throw new Error('Debit and credit amounts must be non-negative')
    if (d > MOCK_GL_EPS && c > MOCK_GL_EPS) throw new Error('Each line must be either a debit or a credit, not both')
    if (d <= MOCK_GL_EPS && c <= MOCK_GL_EPS) throw new Error('Each line must have a positive debit or credit')
    const acc = MOCK_GL_ACCOUNTS.find((a) => a.id === ln.glAccountId.trim())
    if (!acc) throw new Error(`GL account not found: ${ln.glAccountId}`)
    const debit = d > MOCK_GL_EPS ? d : 0
    const credit = c > MOCK_GL_EPS ? c : 0
    sumDr += debit
    sumCr += credit
    normalized.push({ ...ln, glAccountId: acc.id, debit, credit })
  }
  if (Math.abs(sumDr - sumCr) > MOCK_GL_EPS) {
    throw new Error(`Debits (${sumDr.toFixed(2)}) must equal credits (${sumCr.toFixed(2)})`)
  }
  const sourceId = id('glj')
  const entryDate = body.entryDate.slice(0, 10)
  const createdAt = nowIso()
  const bucket = mockGlBucket(projectId)
  const created: GeneralLedgerEntry[] = []
  for (const ln of normalized) {
    const acc = MOCK_GL_ACCOUNTS.find((a) => a.id === ln.glAccountId)!
    const memo =
      ln.memo != null && String(ln.memo).trim() !== '' ? String(ln.memo).trim() : undefined
    const userNotes =
      ln.userNotes != null && String(ln.userNotes).trim() !== ''
        ? String(ln.userNotes).trim()
        : undefined
    const row: GeneralLedgerEntry = {
      id: id('gle'),
      projectId,
      entryDate,
      glAccountId: ln.glAccountId,
      accountCode: acc.code,
      accountName: acc.name,
      debit: ln.debit,
      credit: ln.credit,
      memo,
      userNotes,
      sourceKind: 'manual_journal',
      sourceId,
      isManual: true,
      createdAt,
    }
    bucket.push(row)
    created.push(row)
  }
  return created
}

export async function updateGeneralLedgerEntryNotes(
  projectId: string,
  entryId: string,
  userNotes: string | null,
): Promise<GeneralLedgerEntry> {
  await delay()
  getUserIdOrThrow()
  if (!(await getProject(projectId))) throw new Error('Not found')
  const bucket = mockGlBucket(projectId)
  const row = bucket.find((e) => e.id === entryId)
  if (!row) throw new Error('Not found')
  if (row.projectId !== projectId) throw new Error('Not found')
  const n =
    userNotes != null && String(userNotes).trim() !== '' ? String(userNotes).trim() : undefined
  row.userNotes = n
  return { ...row }
}

export async function deleteManualJournalEntry(projectId: string, entryId: string): Promise<void> {
  await delay()
  getUserIdOrThrow()
  if (!(await getProject(projectId))) throw new Error('Not found')
  const bucket = mockGlBucket(projectId)
  const row = bucket.find((e) => e.id === entryId)
  if (!row) throw new Error('Not found')
  if (row.sourceKind !== 'manual_journal') throw new Error('Only user-posted manual journals can be deleted')
  const sid = row.sourceId
  const next = bucket.filter((e) => e.sourceId !== sid)
  bucket.length = 0
  bucket.push(...next)
}

export async function listVendorDisbursementBatches(
  projectId: string,
  _opts?: { invoiceId?: string; vendorId?: string },
): Promise<VendorDisbursementBatch[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return []
}

export async function getVendorDisbursementBatch(
  _projectId: string,
  _batchId: string,
): Promise<VendorDisbursementBatch | null> {
  await delay()
  return null
}

export async function createVendorDisbursementBatch(
  _projectId: string,
  _body: Record<string, unknown>,
): Promise<VendorDisbursementBatch> {
  throw new Error('Vendor disbursement batches are not persisted in mock mode. Use the backend API.')
}

export async function updateVendorDisbursementBatch(
  _projectId: string,
  _batchId: string,
  _patch: Record<string, unknown>,
): Promise<VendorDisbursementBatch> {
  throw new Error('Vendor disbursement batches are not persisted in mock mode. Use the backend API.')
}

export async function deleteVendorDisbursementBatch(_projectId: string, _batchId: string): Promise<void> {
  throw new Error('Vendor disbursement batches are not persisted in mock mode. Use the backend API.')
}

export async function listVendorAdvances(projectId: string): Promise<VendorAdvance[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return []
}

export async function getVendorAdvance(_projectId: string, _advanceId: string): Promise<VendorAdvance | null> {
  await delay()
  return null
}

export async function createVendorAdvance(
  _projectId: string,
  _body: Record<string, unknown>,
): Promise<VendorAdvance> {
  throw new Error('Vendor advances are not persisted in mock mode. Use the backend API.')
}

export async function updateVendorAdvance(
  _projectId: string,
  _advanceId: string,
  _patch: Record<string, unknown>,
): Promise<VendorAdvance> {
  throw new Error('Vendor advances are not persisted in mock mode. Use the backend API.')
}

export async function deleteVendorAdvance(_projectId: string, _advanceId: string): Promise<void> {
  throw new Error('Vendor advances are not persisted in mock mode. Use the backend API.')
}

export async function createVendorAdvanceUsage(
  _projectId: string,
  _advanceId: string,
  _body: Record<string, unknown>,
): Promise<VendorAdvanceUsage> {
  throw new Error('Vendor advances are not persisted in mock mode. Use the backend API.')
}

export async function updateVendorAdvanceUsage(
  _projectId: string,
  _advanceId: string,
  _usageId: string,
  _patch: Record<string, unknown>,
): Promise<VendorAdvanceUsage> {
  throw new Error('Vendor advances are not persisted in mock mode. Use the backend API.')
}

export async function deleteVendorAdvanceUsage(
  _projectId: string,
  _advanceId: string,
  _usageId: string,
): Promise<void> {
  throw new Error('Vendor advances are not persisted in mock mode. Use the backend API.')
}
