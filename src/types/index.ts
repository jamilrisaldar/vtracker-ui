export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed'

export type PhaseStatus = 'not_started' | 'in_progress' | 'done'

export type PlotStatus = 'open' | 'negotiating' | 'conditional_sale' | 'sold'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue'

export type DocumentKind = 'invoice' | 'payment_proof' | 'progress_photo' | 'other'

export interface User {
  id: string
  email: string
  name: string
  picture?: string
  /** Present when using mock / Google auth. */
  googleSub?: string
  createdAt?: string
  /** Present when using backend session (`SessionUser`). */
  roles?: { id: number | string; name: string }[]
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
  /** Sort order within the project (matches API `displayOrder`). */
  displayOrder: number
}

export interface LandPlot {
  id: string
  projectId: string
  /** Optional label from survey or layout (e.g. "A-12"). */
  plotNumber?: string
  /** First width × length (feet). Required for regular plots; irregular plots use this with pair 2. */
  widthFeet?: number
  lengthFeet?: number
  /** Second width / length (feet). Irregular: four consecutive side lengths W1→L1→W2→L2; area from all four unless overridden. */
  widthFeet2?: number
  lengthFeet2?: number
  isIrregular: boolean
  /** Area from dimensions at last save (W×L or irregular four-side formula); not affected by override. */
  calculatedSquareFeet?: number
  /** When set, displayed sq ft uses this instead of `calculatedSquareFeet`. */
  totalSquareFeetOverride?: number
  pricePerSqft: number
  /** Posted total purchase (optional). */
  totalPurchasePrice?: number
  currency: string
  isReserved: boolean
  status: PlotStatus
  /** Free-form description of the plot. */
  plotDetails?: string
  /** Buyer / party on the purchase (when known). */
  purchaseParty?: string
  /** Agreed or recorded final price per sq ft (after negotiation). */
  finalPricePerSqft?: number
  /** Agreed or recorded final total purchase amount. */
  finalTotalPurchasePrice?: number
  notes?: string
  /** True if the plot is designated for public use (e.g. road, park strip). */
  isPublicUse: boolean
  createdAt: string
  updatedAt: string
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
  paymentMethod?: 'Cash' | 'Cheque' | 'RTGS' | 'Other'
  isPaymentPartial?: boolean
  paymentSource?: string
  comments?: string
}

export interface Account {
  id: string
  projectId?: string
  kind: 'bank' | 'cash'
  name: string
  accountLocation?: string
  currency: string
  createdAt: string
}

export interface AccountTransaction {
  id: string
  projectId?: string
  accountId: string
  amount: number
  entryType: 'debit' | 'credit'
  description?: string
  bankMemo?: string
  transactionCategory?: string
  runningBalance?: number
  plotIds?: string[]
  occurredOn: string
  paymentId?: string
  createdAt: string
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
  /** Backend: authenticated download path or URL from API. */
  downloadUrl?: string
}

/** Aggregated project report (mock computes locally; backend may expose GET .../report). */
export interface ProjectReport {
  project: Project
  totalInvoiced: number
  totalPaid: number
  outstanding: number
  byVendor: { vendorId: string; vendorName: string; invoiced: number; paid: number }[]
  byPhase: { phaseId: string; phaseName: string; status: Phase['status'] }[]
  invoiceCount: number
  paymentCount: number
}

export interface AuthSession {
  /** Mock bearer token (local only). Omitted for cookie-based API auth. */
  token?: string
  user: User
}
