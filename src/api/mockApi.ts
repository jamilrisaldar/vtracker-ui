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
  LandPlot,
  Payment,
  Phase,
  PhaseStatus,
  PlotStatus,
  Project,
  ProjectDocument,
  ProjectReport,
  ProjectStatus,
  User,
  Vendor,
} from '../types'
import { isBackendAuthEnabled } from '../config'
import { enrichAccountFixedDeposit } from '../utils/fixedDepositMetrics'
import { plotCalculatedSqFtFromDimensions } from '../utils/landPlotDisplay'
import {
  clearAuthSession,
  id,
  loadDb,
  readAuthSession,
  saveDb,
  writeAuthSession,
} from './mockDb'
import { getApiSessionUserId } from './apiAuthState'

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

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
    } satisfies User
    db.users.push(user)
  } else {
    user.name = p.name
    user.picture = p.picture
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
  const userId = getUserIdOrThrow()
  return loadDb()
    .projects.filter((p) => p.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getProject(projectId: string): Promise<Project | null> {
  await delay()
  const userId = getUserIdOrThrow()
  const p = loadDb().projects.find((x) => x.id === projectId)
  if (!p || p.userId !== userId) return null
  return p
}

export async function createProject(input: {
  name: string
  description: string
  location?: string
  status?: ProjectStatus
}): Promise<Project> {
  await delay()
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const t = nowIso()
  const project: Project = {
    id: id('proj'),
    userId,
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const p = db.projects.find((x) => x.id === projectId)
  if (!p || p.userId !== userId) throw new Error('Not found')
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const p = db.projects.find((x) => x.id === projectId)
  if (!p || p.userId !== userId) throw new Error('Not found')
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const ph = db.phases.find((x) => x.id === phaseId)
  if (!ph) throw new Error('Not found')
  if (_projectId && ph.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === ph.projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const ph = db.phases.find((x) => x.id === phaseId)
  if (!ph) throw new Error('Not found')
  if (_projectId && ph.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === ph.projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
  db.phases = db.phases.filter((x) => x.id !== phaseId)
  proj.updatedAt = nowIso()
  saveDb(db)
}

// —— Plots ——

export async function listPlots(projectId: string): Promise<LandPlot[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return loadDb()
    .plots.filter((x) => x.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
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
  return plot
}

export async function deletePlot(plotId: string, projectId: string): Promise<void> {
  await delay()
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const plot = db.plots.find((x) => x.id === plotId && x.projectId === projectId)
  if (!plot) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
  db.plots = db.plots.filter((x) => x.id !== plotId)
  proj.updatedAt = nowIso()
  saveDb(db)
}

// —— Vendors ——

export async function listVendors(projectId: string): Promise<Vendor[]> {
  await delay()
  if (!(await getProject(projectId))) throw new Error('Not found')
  return loadDb()
    .vendors.filter((v) => v.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createVendor(input: {
  projectId: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  notes?: string
}): Promise<Vendor> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const v: Vendor = {
    id: id('ven'),
    projectId: input.projectId,
    name: input.name.trim(),
    contactName: input.contactName?.trim() || undefined,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  }
  db.vendors.push(v)
  project.updatedAt = nowIso()
  saveDb(db)
  return v
}

export async function updateVendor(
  vendorId: string,
  patch: Partial<
    Pick<Vendor, 'name' | 'contactName' | 'email' | 'phone' | 'notes'>
  >,
  _projectId?: string,
): Promise<Vendor> {
  await delay()
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const v = db.vendors.find((x) => x.id === vendorId)
  if (!v) throw new Error('Not found')
  if (_projectId && v.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === v.projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
  if (patch.name != null) v.name = patch.name.trim()
  if (patch.contactName !== undefined)
    v.contactName = patch.contactName?.trim() || undefined
  if (patch.email !== undefined) v.email = patch.email?.trim() || undefined
  if (patch.phone !== undefined) v.phone = patch.phone?.trim() || undefined
  if (patch.notes !== undefined) v.notes = patch.notes?.trim() || undefined
  proj.updatedAt = nowIso()
  saveDb(db)
  return v
}

export async function deleteVendor(vendorId: string, _projectId?: string): Promise<void> {
  await delay()
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const v = db.vendors.find((x) => x.id === vendorId)
  if (!v) throw new Error('Not found')
  if (_projectId && v.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === v.projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
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
  currency?: string
  issuedDate: string
  dueDate?: string
  status?: InvoiceStatus
}): Promise<Invoice> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const vendor = db.vendors.find(
    (v) => v.id === input.vendorId && v.projectId === input.projectId,
  )
  if (!vendor) throw new Error('Vendor not found')
  const inv: Invoice = {
    id: id('inv'),
    vendorId: input.vendorId,
    projectId: input.projectId,
    invoiceNumber: input.invoiceNumber.trim(),
    amount: input.amount,
    currency: input.currency ?? 'INR',
    issuedDate: input.issuedDate,
    dueDate: input.dueDate,
    status: input.status ?? 'sent',
  }
  db.invoices.push(inv)
  project.updatedAt = nowIso()
  saveDb(db)
  return inv
}

export async function updateInvoice(
  invoiceId: string,
  patch: Partial<
    Pick<
      Invoice,
      | 'invoiceNumber'
      | 'amount'
      | 'currency'
      | 'issuedDate'
      | 'dueDate'
      | 'status'
    >
  >,
  _projectId?: string,
): Promise<Invoice> {
  await delay()
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const inv = db.invoices.find((x) => x.id === invoiceId)
  if (!inv) throw new Error('Not found')
  if (_projectId && inv.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === inv.projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
  if (patch.invoiceNumber != null) inv.invoiceNumber = patch.invoiceNumber.trim()
  if (patch.amount != null) inv.amount = patch.amount
  if (patch.currency != null) inv.currency = patch.currency
  if (patch.issuedDate != null) inv.issuedDate = patch.issuedDate
  if (patch.dueDate !== undefined) inv.dueDate = patch.dueDate
  if (patch.status != null) inv.status = patch.status
  proj.updatedAt = nowIso()
  saveDb(db)
  return inv
}

export async function deleteInvoice(invoiceId: string, _projectId?: string): Promise<void> {
  await delay()
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const inv = db.invoices.find((x) => x.id === invoiceId)
  if (!inv) throw new Error('Not found')
  if (_projectId && inv.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === inv.projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
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
}): Promise<Payment> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const inv = db.invoices.find(
    (i) => i.id === input.invoiceId && i.projectId === input.projectId,
  )
  if (!inv) throw new Error('Invoice not found')
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
  }
  db.payments.push(pay)
  const paidTotal = db.payments
    .filter((p) => p.invoiceId === inv.id)
    .reduce((s, p) => s + p.amount, 0)
  if (paidTotal >= inv.amount) inv.status = 'paid'
  else if (paidTotal > 0) inv.status = 'partial'
  project.updatedAt = nowIso()
  saveDb(db)
  return pay
}

export async function deletePayment(paymentId: string, _projectId?: string): Promise<void> {
  await delay()
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const pay = db.payments.find((x) => x.id === paymentId)
  if (!pay) throw new Error('Not found')
  if (_projectId && pay.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === pay.projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
  const inv = db.invoices.find((i) => i.id === pay.invoiceId)
  db.payments = db.payments.filter((x) => x.id !== paymentId)
  db.accountTransactions = db.accountTransactions.map((t) =>
    t.paymentId === paymentId ? { ...t, paymentId: undefined } : t,
  )
  if (inv) {
    const paidTotal = db.payments
      .filter((p) => p.invoiceId === inv.id)
      .reduce((s, p) => s + p.amount, 0)
    if (paidTotal <= 0) inv.status = inv.status === 'draft' ? 'draft' : 'sent'
    else if (paidTotal >= inv.amount) inv.status = 'paid'
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  let projectId: string | undefined = input.projectId
  if (projectId) {
    const project = db.projects.find((p) => p.id === projectId && p.userId === userId)
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const acc = db.accounts.find((x) => x.id === accountId)
  if (!acc) throw new Error('Not found')
  if (patch.projectId !== undefined) {
    if (patch.projectId === null || patch.projectId === '') {
      acc.projectId = undefined
    } else {
      const project = db.projects.find((p) => p.id === patch.projectId && p.userId === userId)
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const acc = db.accounts.find((a) => a.id === input.accountId)
  if (!acc) throw new Error('Account not found')

  let txnProjectId: string | undefined = input.projectId
  if (input.paymentId) {
    const pay = db.payments.find((p) => p.id === input.paymentId)
    if (!pay) throw new Error('Payment not found')
    const proj = db.projects.find((p) => p.id === pay.projectId && p.userId === userId)
    if (!proj) throw new Error('Payment not found')
    txnProjectId = pay.projectId
    if (db.accountTransactions.some((t) => t.paymentId === input.paymentId)) {
      throw new Error('A transaction is already linked to this payment')
    }
  } else if (txnProjectId) {
    const project = db.projects.find((p) => p.id === txnProjectId && p.userId === userId)
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const acc = db.accounts.find((a) => a.id === accountId)
  if (!acc) throw new Error('Account not found')
  const idx = db.accountTransactions.findIndex((x) => x.id === transactionId && x.accountId === accountId)
  if (idx < 0) throw new Error('Not found')

  let txnProjectId: string | undefined = input.projectId
  if (input.paymentId) {
    const pay = db.payments.find((p) => p.id === input.paymentId)
    if (!pay) throw new Error('Payment not found')
    const proj = db.projects.find((p) => p.id === pay.projectId && p.userId === userId)
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
    const project = db.projects.find((p) => p.id === txnProjectId && p.userId === userId)
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
  const userId = getUserIdOrThrow()
  const db = loadDb()
  const d = db.documents.find((x) => x.id === documentId)
  if (!d) throw new Error('Not found')
  if (_projectId && d.projectId !== _projectId) throw new Error('Not found')
  const proj = db.projects.find((p) => p.id === d.projectId)
  if (!proj || proj.userId !== userId) throw new Error('Not found')
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
  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0)
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const byVendor = vendors.map((v) => {
    const inv = invoices.filter((i) => i.vendorId === v.id)
    const pay = payments.filter((p) => p.vendorId === v.id)
    return {
      vendorId: v.id,
      vendorName: v.name,
      invoiced: inv.reduce((s, i) => s + i.amount, 0),
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
