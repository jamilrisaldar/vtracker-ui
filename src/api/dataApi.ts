/**
 * Domain data: real backend when `VITE_USE_BACKEND_AUTH` is set, else local mock.
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
import { isBackendAuthEnabled } from '../config'
import * as backend from './backendDataApi'
import * as mock from './mockApi'

export type { ProjectReport } from '../types'

export async function listProjects(): Promise<Project[]> {
  if (isBackendAuthEnabled()) return backend.listProjects()
  return mock.listProjects()
}

export async function getProject(projectId: string): Promise<Project | null> {
  if (isBackendAuthEnabled()) return backend.getProject(projectId)
  return mock.getProject(projectId)
}

export async function createProject(input: {
  name: string
  description: string
  location?: string
  status?: ProjectStatus
}): Promise<Project> {
  if (isBackendAuthEnabled()) return backend.createProject(input)
  return mock.createProject(input)
}

export async function updateProject(
  projectId: string,
  patch: Partial<Pick<Project, 'name' | 'description' | 'location' | 'status'>>,
): Promise<Project> {
  if (isBackendAuthEnabled()) return backend.updateProject(projectId, patch)
  return mock.updateProject(projectId, patch)
}

export async function deleteProject(projectId: string): Promise<void> {
  if (isBackendAuthEnabled()) return backend.deleteProject(projectId)
  return mock.deleteProject(projectId)
}

export async function listPhases(projectId: string): Promise<Phase[]> {
  if (isBackendAuthEnabled()) return backend.listPhases(projectId)
  return mock.listPhases(projectId)
}

export async function createPhase(input: {
  projectId: string
  name: string
  description?: string
  startDate: string
  endDate: string
  status?: PhaseStatus
}): Promise<Phase> {
  if (isBackendAuthEnabled()) return backend.createPhase(input)
  return mock.createPhase(input)
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
  projectId?: string,
): Promise<Phase> {
  if (isBackendAuthEnabled()) {
    if (!projectId) throw new Error('projectId is required')
    return backend.updatePhase(phaseId, patch, projectId)
  }
  return mock.updatePhase(phaseId, patch, projectId)
}

export async function deletePhase(
  phaseId: string,
  projectId?: string,
): Promise<void> {
  if (isBackendAuthEnabled()) {
    if (!projectId) throw new Error('projectId is required')
    return backend.deletePhase(phaseId, projectId)
  }
  return mock.deletePhase(phaseId, projectId)
}

export async function listVendors(projectId: string): Promise<Vendor[]> {
  if (isBackendAuthEnabled()) return backend.listVendors(projectId)
  return mock.listVendors(projectId)
}

export async function createVendor(input: {
  projectId: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  notes?: string
}): Promise<Vendor> {
  if (isBackendAuthEnabled()) return backend.createVendor(input)
  return mock.createVendor(input)
}

export async function updateVendor(
  vendorId: string,
  patch: Partial<
    Pick<Vendor, 'name' | 'contactName' | 'email' | 'phone' | 'notes'>
  >,
  projectId?: string,
): Promise<Vendor> {
  if (isBackendAuthEnabled()) {
    if (!projectId) throw new Error('projectId is required')
    return backend.updateVendor(vendorId, patch, projectId)
  }
  return mock.updateVendor(vendorId, patch, projectId)
}

export async function deleteVendor(
  vendorId: string,
  projectId?: string,
): Promise<void> {
  if (isBackendAuthEnabled()) {
    if (!projectId) throw new Error('projectId is required')
    return backend.deleteVendor(vendorId, projectId)
  }
  return mock.deleteVendor(vendorId, projectId)
}

export async function listInvoices(projectId: string): Promise<Invoice[]> {
  if (isBackendAuthEnabled()) return backend.listInvoices(projectId)
  return mock.listInvoices(projectId)
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
  if (isBackendAuthEnabled()) return backend.createInvoice(input)
  return mock.createInvoice(input)
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
  projectId?: string,
): Promise<Invoice> {
  if (isBackendAuthEnabled()) {
    if (!projectId) throw new Error('projectId is required')
    return backend.updateInvoice(invoiceId, patch, projectId)
  }
  return mock.updateInvoice(invoiceId, patch, projectId)
}

export async function deleteInvoice(
  invoiceId: string,
  projectId?: string,
): Promise<void> {
  if (isBackendAuthEnabled()) {
    if (!projectId) throw new Error('projectId is required')
    return backend.deleteInvoice(invoiceId, projectId)
  }
  return mock.deleteInvoice(invoiceId, projectId)
}

export async function listPayments(projectId: string): Promise<Payment[]> {
  if (isBackendAuthEnabled()) return backend.listPayments(projectId)
  return mock.listPayments(projectId)
}

export async function createPayment(input: {
  projectId: string
  invoiceId: string
  amount: number
  paidDate: string
  method?: string
  reference?: string
}): Promise<Payment> {
  if (isBackendAuthEnabled()) return backend.createPayment(input)
  return mock.createPayment(input)
}

export async function deletePayment(
  paymentId: string,
  projectId?: string,
): Promise<void> {
  if (isBackendAuthEnabled()) {
    if (!projectId) throw new Error('projectId is required')
    return backend.deletePayment(paymentId, projectId)
  }
  return mock.deletePayment(paymentId, projectId)
}

export async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  if (isBackendAuthEnabled()) return backend.listDocuments(projectId)
  return mock.listDocuments(projectId)
}

export async function uploadDocument(input: {
  projectId: string
  file: File
  kind: DocumentKind
  vendorId?: string
  invoiceId?: string
  paymentId?: string
}): Promise<ProjectDocument> {
  if (isBackendAuthEnabled()) return backend.uploadDocument(input)
  return mock.uploadDocument(input)
}

export async function deleteDocument(
  documentId: string,
  projectId?: string,
): Promise<void> {
  if (isBackendAuthEnabled()) {
    if (!projectId) throw new Error('projectId is required')
    return backend.deleteDocument(documentId, projectId)
  }
  return mock.deleteDocument(documentId, projectId)
}

export async function getProjectReport(projectId: string): Promise<ProjectReport> {
  if (isBackendAuthEnabled()) return backend.getProjectReport(projectId)
  return mock.getProjectReport(projectId)
}
