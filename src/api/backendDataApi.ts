/**
 * REST client for VTracker domain API (OpenAPI /api/v1/...).
 * Requires cookie session + CSRF on mutating requests.
 */
import type {
  DocumentKind,
  Invoice,
  InvoiceStatus,
  Payment,
  Phase,
  PhaseStatus,
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

/** Normalize API phase JSON (legacy `order` → `displayOrder`). */
function normalizePhase(raw: Record<string, unknown>): Phase {
  const displayOrder =
    typeof raw.displayOrder === 'number'
      ? raw.displayOrder
      : typeof raw.order === 'number'
        ? raw.order
        : 0
  return { ...(raw as unknown as Phase), displayOrder }
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
  description?: string
  startDate: string
  endDate: string
  status?: PhaseStatus
}): Promise<Phase> {
  const created = await apiRequest<Record<string, unknown>>(
    `/api/v1/projects/${encodeURIComponent(input.projectId)}/phases`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name.trim(),
        description: input.description?.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
      }),
    },
  )
  return normalizePhase(created)
}

export async function updatePhase(
  phaseId: string,
  patch: Partial<
    Pick<
      Phase,
      | 'name'
      | 'description'
      | 'startDate'
      | 'endDate'
      | 'status'
      | 'displayOrder'
    >
  >,
  projectId: string,
): Promise<Phase> {
  const body: Record<string, unknown> = {}
  if (patch.name != null) body.name = patch.name.trim()
  if (patch.description !== undefined) body.description = patch.description?.trim()
  if (patch.startDate != null) body.startDate = patch.startDate
  if (patch.endDate != null) body.endDate = patch.endDate
  if (patch.status != null) body.status = patch.status
  if (patch.displayOrder != null) body.displayOrder = patch.displayOrder
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
        currency: input.currency ?? 'USD',
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
