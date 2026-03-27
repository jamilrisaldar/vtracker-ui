/**
 * REST client for VTracker domain API (OpenAPI /api/v1/...).
 * Requires cookie session + CSRF on mutating requests.
 */
import type {
  Account,
  AccountFixedDeposit,
  AccountFixedDepositStatus,
  AccountTransaction,
  AccountTransactionListFilters,
  DocumentKind,
  Invoice,
  InvoiceStatus,
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
  Vendor,
} from '../types'
import { apiUrl } from '../config'
import { fetchCsrfToken, readErrorMessage } from './backendAuth'

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase()
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const headers = new Headers(init.headers)
  if (needsCsrf) {
    const csrf = await fetchCsrfToken()
    headers.set('X-CSRF-Token', csrf)
  }
  const isForm = init.body instanceof FormData
  if (init.body != null && !isForm && !headers.has('Content-Type')) {
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

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isNaN(n) ? fallback : n
  }
  return fallback
}

function asOptionalNumber(v: unknown): number | undefined {
  if (v == null) return undefined
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Normalize API phase JSON (legacy `order` → `displayOrder`, `description` → `notes`). */
function normalizePhase(raw: Record<string, unknown>): Phase {
  const displayOrder =
    typeof raw.displayOrder === 'number'
      ? raw.displayOrder
      : typeof raw.order === 'number'
        ? raw.order
        : 0
  const notesFromApi =
    typeof raw.notes === 'string' && raw.notes.trim() !== ''
      ? raw.notes
      : typeof raw.description === 'string' && raw.description.trim() !== ''
        ? raw.description
        : undefined
  return {
    ...(raw as unknown as Phase),
    displayOrder,
    notes: notesFromApi,
    estimatedTotal: asOptionalNumber(raw.estimatedTotal),
    actualSpend: asOptionalNumber(raw.actualSpend),
  }
}

// —— Projects ——

export async function listProjects(): Promise<Project[]> {
  return apiRequest<Project[]>('/api/v1/projects')
}

export async function getProject(id: string): Promise<Project | null> {
  const r = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(id)}`), {
    credentials: 'include',
  })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(await readErrorMessage(r))
  return r.json() as Promise<Project>
}

export async function createProject(input: {
  name: string
  description: string
  location?: string
  status?: ProjectStatus
}): Promise<Project> {
  return apiRequest<Project>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      description: input.description.trim(),
      location: input.location?.trim() || undefined,
      status: input.status,
    }),
  })
}

export async function updateProject(
  projectId: string,
  patch: Partial<Pick<Project, 'name' | 'description' | 'location' | 'status'>>,
): Promise<Project> {
  const body: Record<string, unknown> = {}
  if (patch.name != null) body.name = patch.name.trim()
  if (patch.description != null) body.description = patch.description.trim()
  if (patch.location !== undefined) body.location = patch.location?.trim() ?? null
  if (patch.status != null) body.status = patch.status
  return apiRequest<Project>(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  })
}

// —— Phases ——

export async function listPhases(projectId: string): Promise<Phase[]> {
  const rows = await apiRequest<Record<string, unknown>[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/phases`,
  )
  return rows.map((row) => normalizePhase(row))
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
  const created = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(input.projectId)}/phases`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name.trim(),
        notes: input.notes?.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        estimatedTotal: input.estimatedTotal,
        actualSpend: input.actualSpend,
      }),
    },
  )
  return normalizePhase(created)
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
  projectId: string,
): Promise<Phase> {
  const body: Record<string, unknown> = {}
  if (patch.name != null) body.name = patch.name.trim()
  if (patch.notes !== undefined) body.notes = patch.notes?.trim() ?? null
  if (patch.startDate != null) body.startDate = patch.startDate
  if (patch.endDate != null) body.endDate = patch.endDate
  if (patch.status != null) body.status = patch.status
  if (patch.displayOrder != null) body.displayOrder = patch.displayOrder
  if (patch.estimatedTotal !== undefined) body.estimatedTotal = patch.estimatedTotal
  if (patch.actualSpend !== undefined) body.actualSpend = patch.actualSpend
  const updated = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/phases/${encodeURIComponent(phaseId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
  return normalizePhase(updated)
}

export async function deletePhase(phaseId: string, projectId: string): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/phases/${encodeURIComponent(phaseId)}`,
    { method: 'DELETE' },
  )
}

// —— Plots ——

export async function listPlots(projectId: string): Promise<LandPlot[]> {
  return apiRequest<LandPlot[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots`,
  )
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
  return apiRequest<LandPlot>(
    `/api/v1/projects/${encodeURIComponent(input.projectId)}/plots`,
    {
      method: 'POST',
      body: JSON.stringify({
        plotNumber: input.plotNumber?.trim(),
        isIrregular: input.isIrregular,
        widthFeet: input.widthFeet,
        lengthFeet: input.lengthFeet,
        widthFeet2: input.widthFeet2,
        lengthFeet2: input.lengthFeet2,
        totalSquareFeetOverride: input.totalSquareFeetOverride,
        pricePerSqft: input.pricePerSqft,
        totalPurchasePrice: input.totalPurchasePrice,
        currency: input.currency?.trim(),
        isReserved: input.isReserved,
        status: input.status,
        plotDetails: input.plotDetails?.trim(),
        purchaseParty: input.purchaseParty?.trim(),
        finalPricePerSqft: input.finalPricePerSqft,
        finalTotalPurchasePrice: input.finalTotalPurchasePrice,
        notes: input.notes?.trim(),
        isPublicUse: input.isPublicUse,
      }),
    },
  )
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
  const body: Record<string, unknown> = {}
  if (patch.plotNumber !== undefined) body.plotNumber = patch.plotNumber?.trim() ?? null
  if (patch.isIrregular !== undefined) body.isIrregular = patch.isIrregular
  if (patch.widthFeet !== undefined) body.widthFeet = patch.widthFeet
  if (patch.lengthFeet !== undefined) body.lengthFeet = patch.lengthFeet
  if (patch.widthFeet2 !== undefined) body.widthFeet2 = patch.widthFeet2
  if (patch.lengthFeet2 !== undefined) body.lengthFeet2 = patch.lengthFeet2
  if (patch.totalSquareFeetOverride !== undefined) {
    body.totalSquareFeetOverride = patch.totalSquareFeetOverride
  }
  if (patch.pricePerSqft !== undefined) body.pricePerSqft = patch.pricePerSqft
  if (patch.totalPurchasePrice !== undefined) body.totalPurchasePrice = patch.totalPurchasePrice
  if (patch.currency !== undefined) body.currency = patch.currency.trim()
  if (patch.isReserved !== undefined) body.isReserved = patch.isReserved
  if (patch.status !== undefined) body.status = patch.status
  if (patch.plotDetails !== undefined) body.plotDetails = patch.plotDetails?.trim() ?? null
  if (patch.purchaseParty !== undefined) body.purchaseParty = patch.purchaseParty?.trim() ?? null
  if (patch.finalPricePerSqft !== undefined) body.finalPricePerSqft = patch.finalPricePerSqft
  if (patch.finalTotalPurchasePrice !== undefined) {
    body.finalTotalPurchasePrice = patch.finalTotalPurchasePrice
  }
  if (patch.notes !== undefined) body.notes = patch.notes?.trim() ?? null
  if (patch.isPublicUse !== undefined) body.isPublicUse = patch.isPublicUse
  return apiRequest<LandPlot>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

export async function deletePlot(plotId: string, projectId: string): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}`,
    { method: 'DELETE' },
  )
}

function normalizePlotSale(raw: Record<string, unknown>): PlotSale {
  const combinedPlotIds = Array.isArray(raw.combinedPlotIds)
    ? raw.combinedPlotIds.map((x) => String(x))
    : undefined
  return {
    id: String(raw.id),
    plotId: String(raw.plotId),
    purchaserName:
      typeof raw.purchaserName === 'string' && raw.purchaserName.trim() !== ''
        ? raw.purchaserName
        : undefined,
    negotiatedFinalPrice: asOptionalNumber(raw.negotiatedFinalPrice),
    agentCommissionPercent: asOptionalNumber(raw.agentCommissionPercent),
    agentCommissionAmount: asOptionalNumber(raw.agentCommissionAmount),
    stampDutyPrice: asOptionalNumber(raw.stampDutyPrice),
    agreementPrice: asOptionalNumber(raw.agreementPrice),
    currency: typeof raw.currency === 'string' ? raw.currency : 'INR',
    paymentsLocked: raw.paymentsLocked === true,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    combinedGroupId:
      typeof raw.combinedGroupId === 'string' ? raw.combinedGroupId : undefined,
    combinedDisplayName:
      typeof raw.combinedDisplayName === 'string' ? raw.combinedDisplayName : undefined,
    combinedPlotIds,
  }
}

function normalizePlotSalePayment(raw: Record<string, unknown>): PlotSalePayment {
  return {
    id: String(raw.id),
    plotId: raw.plotId != null ? String(raw.plotId) : undefined,
    saleGroupId: raw.saleGroupId != null ? String(raw.saleGroupId) : undefined,
    paymentMode: String(raw.paymentMode ?? ''),
    paidDate: String(raw.paidDate ?? '').slice(0, 10),
    amount: asOptionalNumber(raw.amount),
    notes:
      typeof raw.notes === 'string' && raw.notes.trim() !== '' ? raw.notes : undefined,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

function normalizePlotSaleAgentPayment(raw: Record<string, unknown>): PlotSaleAgentPayment {
  return normalizePlotSalePayment(raw)
}

function normalizeCombinedPlotSaleGroup(raw: Record<string, unknown>): CombinedPlotSaleGroup {
  return {
    id: String(raw.id),
    projectId: String(raw.projectId),
    displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
    plotIds: Array.isArray(raw.plotIds) ? raw.plotIds.map((x) => String(x)) : [],
    purchaserName:
      typeof raw.purchaserName === 'string' && raw.purchaserName.trim() !== ''
        ? raw.purchaserName
        : undefined,
    negotiatedFinalPrice: asOptionalNumber(raw.negotiatedFinalPrice),
    agentCommissionPercent: asOptionalNumber(raw.agentCommissionPercent),
    agentCommissionAmount: asOptionalNumber(raw.agentCommissionAmount),
    stampDutyPrice: asOptionalNumber(raw.stampDutyPrice),
    agreementPrice: asOptionalNumber(raw.agreementPrice),
    currency: typeof raw.currency === 'string' ? raw.currency : 'INR',
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

export async function getPlotSale(
  plotId: string,
  projectId: string,
): Promise<PlotSale | null> {
  const raw = await apiRequest<PlotSale | null>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale`,
  )
  if (raw == null) return null
  return normalizePlotSale(raw as unknown as Record<string, unknown>)
}

export async function upsertPlotSale(
  plotId: string,
  projectId: string,
  body: {
    purchaserName?: string | null
    negotiatedFinalPrice?: number | null
    agentCommissionPercent?: number | null
    agentCommissionAmount?: number | null
    stampDutyPrice?: number | null
    agreementPrice?: number | null
    currency?: string
    paymentsLocked?: boolean
  },
): Promise<PlotSale> {
  const payload: Record<string, unknown> = {}
  if ('purchaserName' in body) payload.purchaserName = body.purchaserName?.trim() ?? null
  if ('negotiatedFinalPrice' in body) payload.negotiatedFinalPrice = body.negotiatedFinalPrice ?? null
  if ('agentCommissionPercent' in body) payload.agentCommissionPercent = body.agentCommissionPercent ?? null
  if ('agentCommissionAmount' in body) payload.agentCommissionAmount = body.agentCommissionAmount ?? null
  if ('stampDutyPrice' in body) payload.stampDutyPrice = body.stampDutyPrice ?? null
  if ('agreementPrice' in body) payload.agreementPrice = body.agreementPrice ?? null
  if ('currency' in body) payload.currency = body.currency?.trim() || 'INR'
  if ('paymentsLocked' in body) payload.paymentsLocked = Boolean(body.paymentsLocked)
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
  return normalizePlotSale(raw)
}

export async function listPlotSalePayments(
  plotId: string,
  projectId: string,
): Promise<PlotSalePayment[]> {
  const rows = await apiRequest<Record<string, unknown>[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale/payments`,
  )
  return (rows ?? []).map(normalizePlotSalePayment)
}

export async function createPlotSalePayment(
  plotId: string,
  projectId: string,
  input: {
    paymentMode: string
    paidDate: string
    amount?: number | null
    notes?: string | null
  },
): Promise<PlotSalePayment> {
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale/payments`,
    {
      method: 'POST',
      body: JSON.stringify({
        paymentMode: input.paymentMode.trim(),
        paidDate: input.paidDate,
        amount: input.amount ?? null,
        notes: input.notes?.trim() ?? null,
      }),
    },
  )
  return normalizePlotSalePayment(raw)
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
  }>,
): Promise<PlotSalePayment> {
  const body: Record<string, unknown> = {}
  if (patch.paymentMode !== undefined) body.paymentMode = patch.paymentMode.trim()
  if (patch.paidDate !== undefined) body.paidDate = patch.paidDate
  if (patch.amount !== undefined) body.amount = patch.amount
  if (patch.notes !== undefined) body.notes = patch.notes?.trim() ?? null
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale/payments/${encodeURIComponent(paymentId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
  return normalizePlotSalePayment(raw)
}

export async function deletePlotSalePayment(
  plotId: string,
  paymentId: string,
  projectId: string,
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale/payments/${encodeURIComponent(paymentId)}`,
    { method: 'DELETE' },
  )
}

export async function listPlotSaleAgentPayments(
  plotId: string,
  projectId: string,
): Promise<PlotSaleAgentPayment[]> {
  const rows = await apiRequest<Record<string, unknown>[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale/agent-payments`,
  )
  return (rows ?? []).map(normalizePlotSaleAgentPayment)
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
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale/agent-payments`,
    {
      method: 'POST',
      body: JSON.stringify({
        paymentMode: input.paymentMode.trim(),
        paidDate: input.paidDate,
        amount: input.amount ?? null,
        notes: input.notes?.trim() ?? null,
      }),
    },
  )
  return normalizePlotSaleAgentPayment(raw)
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
  const body: Record<string, unknown> = {}
  if (patch.paymentMode !== undefined) body.paymentMode = patch.paymentMode.trim()
  if (patch.paidDate !== undefined) body.paidDate = patch.paidDate
  if (patch.amount !== undefined) body.amount = patch.amount
  if (patch.notes !== undefined) body.notes = patch.notes?.trim() ?? null
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale/agent-payments/${encodeURIComponent(agentPaymentId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
  return normalizePlotSaleAgentPayment(raw)
}

export async function deletePlotSaleAgentPayment(
  plotId: string,
  agentPaymentId: string,
  projectId: string,
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plots/${encodeURIComponent(plotId)}/sale/agent-payments/${encodeURIComponent(agentPaymentId)}`,
    { method: 'DELETE' },
  )
}

export async function createCombinedPlotSaleGroup(input: {
  projectId: string
  displayName?: string
  plotIds: string[]
}): Promise<CombinedPlotSaleGroup> {
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(input.projectId)}/plot-sale-groups`,
    {
      method: 'POST',
      body: JSON.stringify({
        displayName: input.displayName?.trim() ?? '',
        plotIds: input.plotIds,
      }),
    },
  )
  return normalizeCombinedPlotSaleGroup(raw)
}

export async function getCombinedPlotSaleGroup(
  groupId: string,
  projectId: string,
): Promise<CombinedPlotSaleGroup> {
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plot-sale-groups/${encodeURIComponent(groupId)}`,
  )
  return normalizeCombinedPlotSaleGroup(raw)
}

export async function updateCombinedPlotSaleGroup(
  groupId: string,
  projectId: string,
  patch: { displayName?: string; plotIds?: string[] },
): Promise<CombinedPlotSaleGroup> {
  const body: Record<string, unknown> = {}
  if (patch.displayName !== undefined) body.displayName = patch.displayName.trim()
  if (patch.plotIds !== undefined) body.plotIds = patch.plotIds
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plot-sale-groups/${encodeURIComponent(groupId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
  return normalizeCombinedPlotSaleGroup(raw)
}

export async function deleteCombinedPlotSaleGroup(
  groupId: string,
  projectId: string,
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/plot-sale-groups/${encodeURIComponent(groupId)}`,
    { method: 'DELETE' },
  )
}

// —— Vendors ——

export async function listVendors(projectId: string): Promise<Vendor[]> {
  return apiRequest<Vendor[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/vendors`,
  )
}

export async function createVendor(input: {
  projectId: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  notes?: string
}): Promise<Vendor> {
  return apiRequest<Vendor>(
    `/api/v1/projects/${encodeURIComponent(input.projectId)}/vendors`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name.trim(),
        contactName: input.contactName?.trim(),
        email: input.email?.trim(),
        phone: input.phone?.trim(),
        notes: input.notes?.trim(),
      }),
    },
  )
}

export async function updateVendor(
  vendorId: string,
  patch: Partial<
    Pick<Vendor, 'name' | 'contactName' | 'email' | 'phone' | 'notes'>
  >,
  projectId: string,
): Promise<Vendor> {
  const body: Record<string, unknown> = {}
  if (patch.name != null) body.name = patch.name.trim()
  if (patch.contactName !== undefined) body.contactName = patch.contactName?.trim()
  if (patch.email !== undefined) body.email = patch.email?.trim()
  if (patch.phone !== undefined) body.phone = patch.phone?.trim()
  if (patch.notes !== undefined) body.notes = patch.notes?.trim()
  return apiRequest<Vendor>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/vendors/${encodeURIComponent(vendorId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

export async function deleteVendor(vendorId: string, projectId: string): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/vendors/${encodeURIComponent(vendorId)}`,
    { method: 'DELETE' },
  )
}

// —— Invoices ——

export async function listInvoices(projectId: string): Promise<Invoice[]> {
  return apiRequest<Invoice[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/invoices`,
  )
}

export async function listInvoicesByVendor(projectId: string, vendorId: string): Promise<Invoice[]> {
  return apiRequest<Invoice[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/invoices/by-vendor/${encodeURIComponent(vendorId)}`,
  )
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
  return apiRequest<Invoice>(
    `/api/v1/projects/${encodeURIComponent(input.projectId)}/invoices`,
    {
      method: 'POST',
      body: JSON.stringify({
        vendorId: input.vendorId,
        invoiceNumber: input.invoiceNumber.trim(),
        amount: input.amount,
        currency: input.currency ?? 'INR',
        issuedDate: input.issuedDate,
        dueDate: input.dueDate,
        status: input.status ?? 'sent',
      }),
    },
  )
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
  projectId: string,
): Promise<Invoice> {
  const body: Record<string, unknown> = {}
  if (patch.invoiceNumber != null) body.invoiceNumber = patch.invoiceNumber.trim()
  if (patch.amount != null) body.amount = patch.amount
  if (patch.currency != null) body.currency = patch.currency
  if (patch.issuedDate != null) body.issuedDate = patch.issuedDate
  if (patch.dueDate !== undefined) body.dueDate = patch.dueDate
  if (patch.status != null) body.status = patch.status
  return apiRequest<Invoice>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/invoices/${encodeURIComponent(invoiceId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

export async function deleteInvoice(invoiceId: string, projectId: string): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/invoices/${encodeURIComponent(invoiceId)}`,
    { method: 'DELETE' },
  )
}

// —— Payments ——

export async function listPayments(projectId: string): Promise<Payment[]> {
  return apiRequest<Payment[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/payments`,
  )
}

export async function listPaymentsByVendor(projectId: string, vendorId: string): Promise<Payment[]> {
  return apiRequest<Payment[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/payments/by-vendor/${encodeURIComponent(vendorId)}`,
  )
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
  return apiRequest<Payment>(
    `/api/v1/projects/${encodeURIComponent(input.projectId)}/payments`,
    {
      method: 'POST',
      body: JSON.stringify({
        invoiceId: input.invoiceId,
        amount: input.amount,
        paidDate: input.paidDate,
        method: input.method?.trim(),
        reference: input.reference?.trim(),
        paymentMethod: input.paymentMethod,
        isPaymentPartial: input.isPaymentPartial,
        paymentSource: input.paymentSource?.trim(),
        comments: input.comments?.trim(),
      }),
    },
  )
}

export async function deletePayment(paymentId: string, projectId: string): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/payments/${encodeURIComponent(paymentId)}`,
    { method: 'DELETE' },
  )
}

// —— Ledger accounts (user-wide) ——

export async function listAccounts(): Promise<Account[]> {
  return apiRequest<Account[]>('/api/v1/accounts')
}

export async function createAccount(input: {
  kind: 'bank' | 'cash'
  name: string
  currency?: string
  accountLocation?: string
  projectId?: string
}): Promise<Account> {
  return apiRequest<Account>('/api/v1/accounts', {
    method: 'POST',
    body: JSON.stringify({
      kind: input.kind,
      name: input.name.trim(),
      currency: input.currency?.trim() || 'INR',
      accountLocation: input.accountLocation?.trim(),
      projectId: input.projectId,
    }),
  })
}

export async function updateAccount(
  accountId: string,
  patch: Partial<Pick<Account, 'kind' | 'name' | 'currency' | 'accountLocation' | 'projectId'>>,
): Promise<Account> {
  const body: Record<string, unknown> = {}
  if (patch.kind != null) body.kind = patch.kind
  if (patch.name != null) body.name = patch.name.trim()
  if (patch.currency != null) body.currency = patch.currency.trim()
  if (patch.accountLocation !== undefined) body.accountLocation = patch.accountLocation?.trim() ?? null
  if (patch.projectId !== undefined) body.projectId = patch.projectId
  return apiRequest<Account>(`/api/v1/accounts/${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteAccount(accountId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' })
}

export async function listAccountTransactions(
  accountId: string,
  filters?: AccountTransactionListFilters,
): Promise<AccountTransaction[]> {
  const sp = new URLSearchParams()
  if (filters?.occurredOnFrom?.trim()) sp.set('occurredOnFrom', filters.occurredOnFrom.trim())
  if (filters?.occurredOnTo?.trim()) sp.set('occurredOnTo', filters.occurredOnTo.trim())
  if (filters?.projectId?.trim()) sp.set('projectId', filters.projectId.trim())
  if (filters?.descriptionContains?.trim())
    sp.set('descriptionContains', filters.descriptionContains.trim())
  if (filters?.bankMemoContains?.trim()) sp.set('bankMemoContains', filters.bankMemoContains.trim())
  if (filters?.transactionCategoryContains?.trim())
    sp.set('transactionCategoryContains', filters.transactionCategoryContains.trim())
  const q = sp.toString()
  const path = `/api/v1/accounts/${encodeURIComponent(accountId)}/transactions${q ? `?${q}` : ''}`
  return apiRequest<AccountTransaction[]>(path)
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
  return apiRequest<AccountTransaction>(
    `/api/v1/accounts/${encodeURIComponent(input.accountId)}/transactions`,
    {
      method: 'POST',
      body: JSON.stringify({
        amount: input.amount,
        entryType: input.entryType,
        description: input.description?.trim(),
        bankMemo: input.bankMemo?.trim(),
        transactionCategory: input.transactionCategory?.trim(),
        occurredOn: input.occurredOn,
        paymentId: input.paymentId,
        projectId: input.projectId,
        plotIds: input.plotIds,
      }),
    },
  )
}

export async function updateAccountTransaction(
  transactionId: string,
  accountId: string,
  patch: {
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
  return apiRequest<AccountTransaction>(
    `/api/v1/accounts/${encodeURIComponent(accountId)}/transactions/${encodeURIComponent(transactionId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        amount: patch.amount,
        entryType: patch.entryType,
        description: patch.description?.trim(),
        bankMemo: patch.bankMemo?.trim(),
        transactionCategory: patch.transactionCategory?.trim(),
        occurredOn: patch.occurredOn,
        paymentId: patch.paymentId,
        projectId: patch.projectId,
        plotIds: patch.plotIds,
      }),
    },
  )
}

export async function listAccountTransactionCategories(): Promise<string[]> {
  return apiRequest<string[]>('/api/v1/accounts/transaction-categories')
}

export async function deleteAccountTransaction(
  transactionId: string,
  accountId: string,
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/accounts/${encodeURIComponent(accountId)}/transactions/${encodeURIComponent(transactionId)}`,
    { method: 'DELETE' },
  )
}

export async function listAccountFixedDeposits(accountId: string): Promise<AccountFixedDeposit[]> {
  return apiRequest<AccountFixedDeposit[]>(
    `/api/v1/accounts/${encodeURIComponent(accountId)}/fixed-deposits`,
  )
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
  return apiRequest<AccountFixedDeposit>(
    `/api/v1/accounts/${encodeURIComponent(input.accountId)}/fixed-deposits`,
    {
      method: 'POST',
      body: JSON.stringify({
        certificateNumber: input.certificateNumber.trim(),
        effectiveDate: input.effectiveDate,
        principalAmount: input.principalAmount,
        annualRatePercent: input.annualRatePercent,
        maturityValue: input.maturityValue,
        maturityDate: input.maturityDate,
        status: input.status,
        notes: input.notes?.trim(),
      }),
    },
  )
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
  const body: Record<string, unknown> = {}
  if (patch.certificateNumber != null) body.certificateNumber = patch.certificateNumber.trim()
  if (patch.effectiveDate != null) body.effectiveDate = patch.effectiveDate
  if (patch.principalAmount != null) body.principalAmount = patch.principalAmount
  if (patch.annualRatePercent != null) body.annualRatePercent = patch.annualRatePercent
  if (patch.maturityValue != null) body.maturityValue = patch.maturityValue
  if (patch.maturityDate != null) body.maturityDate = patch.maturityDate
  if (patch.status != null) body.status = patch.status
  if (patch.notes !== undefined) body.notes = patch.notes?.trim() ?? null
  return apiRequest<AccountFixedDeposit>(
    `/api/v1/accounts/${encodeURIComponent(accountId)}/fixed-deposits/${encodeURIComponent(depositId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

export async function deleteAccountFixedDeposit(depositId: string, accountId: string): Promise<void> {
  await apiRequest<void>(
    `/api/v1/accounts/${encodeURIComponent(accountId)}/fixed-deposits/${encodeURIComponent(depositId)}`,
    { method: 'DELETE' },
  )
}

// —— Documents ——

export async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  const rows = await apiRequest<ProjectDocument[]>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/documents`,
  )
  return rows.map((d) => ({ ...d }))
}

export async function uploadDocument(input: {
  projectId: string
  file: File
  kind: DocumentKind
  vendorId?: string
  invoiceId?: string
  paymentId?: string
}): Promise<ProjectDocument> {
  const form = new FormData()
  form.set('kind', input.kind)
  form.set('file', input.file)
  if (input.vendorId) form.set('vendorId', input.vendorId)
  if (input.invoiceId) form.set('invoiceId', input.invoiceId)
  if (input.paymentId) form.set('paymentId', input.paymentId)

  const csrf = await fetchCsrfToken()
  const r = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(input.projectId)}/documents`),
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrf },
      body: form,
    },
  )
  if (!r.ok) throw new Error(await readErrorMessage(r))
  return (await r.json()) as ProjectDocument
}

export async function deleteDocument(
  documentId: string,
  projectId: string,
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  )
}

// —— Report ——

interface ReportDto {
  totalInvoiced?: unknown
  totalPaid?: unknown
  outstanding?: unknown
  invoiceCount?: unknown
  paymentCount?: unknown
  byVendor?: Array<Record<string, unknown>>
  byPhase?: Array<Record<string, unknown>>
}

export async function getProjectReport(projectId: string): Promise<ProjectReport> {
  const project = await getProject(projectId)
  if (!project) throw new Error('Not found')
  const raw = await apiRequest<ReportDto>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/report`,
  )
  const byVendor = (raw.byVendor ?? []).map((row) => ({
    vendorId: String(row.vendorId ?? row.vendor_id ?? ''),
    vendorName: String(row.vendorName ?? row.vendor_name ?? ''),
    invoiced: asNum(row.invoiced),
    paid: asNum(row.paid),
  }))
  const byPhase = (raw.byPhase ?? []).map((row) => ({
    phaseId: String(row.phaseId ?? row.phase_id ?? ''),
    phaseName: String(
      row.phaseName ?? row.phase_name ?? row.name ?? '',
    ),
    status: row.status as Phase['status'],
  }))
  return {
    project,
    totalInvoiced: asNum(raw.totalInvoiced),
    totalPaid: asNum(raw.totalPaid),
    outstanding: asNum(raw.outstanding),
    byVendor,
    byPhase,
    invoiceCount: asNum(raw.invoiceCount, 0),
    paymentCount: asNum(raw.paymentCount, 0),
  }
}
