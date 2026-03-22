export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed'

export type PhaseStatus = 'not_started' | 'in_progress' | 'done'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue'

export type DocumentKind = 'invoice' | 'payment_proof' | 'progress_photo' | 'other'

export interface User {
  id: string
  email: string
  name: string
  picture?: string
  googleSub: string
  createdAt: string
}

export interface Project {
  id: string
  userId: string
  name: string
  description: string
  location?: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export interface Phase {
  id: string
  projectId: string
  name: string
  description?: string
  startDate: string
  endDate: string
  status: PhaseStatus
  order: number
}

export interface Vendor {
  id: string
  projectId: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  notes?: string
}

export interface Invoice {
  id: string
  vendorId: string
  projectId: string
  invoiceNumber: string
  amount: number
  currency: string
  issuedDate: string
  dueDate?: string
  status: InvoiceStatus
}

export interface Payment {
  id: string
  invoiceId: string
  vendorId: string
  projectId: string
  amount: number
  paidDate: string
  method?: string
  reference?: string
}

export interface ProjectDocument {
  id: string
  projectId: string
  vendorId?: string
  invoiceId?: string
  paymentId?: string
  kind: DocumentKind
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
  /** Mock persistence: optional base64 data URL (small files only). */
  dataUrl?: string
}

export interface AuthSession {
  token: string
  user: User
}
