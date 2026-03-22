import type {
  AuthSession,
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
  User,
  Vendor,
} from '../types'
import { isBackendAuthEnabled } from '../config'
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
  db.vendors = db.vendors.filter((x) => x.projectId !== projectId)
  const invIds = new Set(
    db.invoices.filter((i) => i.projectId === projectId).map((i) => i.id),
  )
  db.invoices = db.invoices.filter((i) => i.projectId !== projectId)
  db.payments = db.payments.filter(
    (p) => p.projectId !== projectId && !invIds.has(p.invoiceId),
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
    .sort((a, b) => a.order - b.order || a.startDate.localeCompare(b.startDate))
}

export async function createPhase(input: {
  projectId: string
  name: string
  description?: string
  startDate: string
  endDate: string
  status?: PhaseStatus
}): Promise<Phase> {
  await delay()
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Not found')
  const db = loadDb()
  const existing = db.phases.filter((x) => x.projectId === input.projectId)
  const order =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((x) => x.order)) + 1
  const phase: Phase = {
    id: id('phase'),
    projectId: input.projectId,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status ?? 'not_started',
    order,
  }
  db.phases.push(phase)
  project.updatedAt = nowIso()
  saveDb(db)
  return phase
}

export async function updatePhase(
  phaseId: string,
  patch: Partial<
    Pick<Phase, 'name' | 'description' | 'startDate' | 'endDate' | 'status' | 'order'>
  >,
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
  if (patch.description !== undefined)
    ph.description = patch.description?.trim() || undefined
  if (patch.startDate != null) ph.startDate = patch.startDate
  if (patch.endDate != null) ph.endDate = patch.endDate
  if (patch.status != null) ph.status = patch.status
  if (patch.order != null) ph.order = patch.order
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
    currency: input.currency ?? 'USD',
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

export async function createPayment(input: {
  projectId: string
  invoiceId: string
  amount: number
  paidDate: string
  method?: string
  reference?: string
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
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        phaseId: p.id,
        phaseName: p.name,
        status: p.status,
      })),
    invoiceCount: invoices.length,
    paymentCount: payments.length,
  }
}
