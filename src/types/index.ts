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
  /** Free-form notes (optional). */
  notes?: string
  /** Optional budget / total estimate. */
  estimatedTotal?: number
  /** Optional recorded spend. */
  actualSpend?: number
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
  /** Present when this plot is part of a multi-plot deal with shared buyer payments. */
  combinedSale?: {
    groupId: string
    displayName: string
    plotCount: number
    /** Comma-separated plot numbers in the group (for tooltips). */
    plotNumbersSummary?: string
  }
}

/** Recorded sale terms for a plot (optional; one per plot). */
export interface PlotSale {
  id: string
  plotId: string
  purchaserName?: string
  /** ISO date YYYY-MM-DD */
  subregistrarRegistrationDate?: string
  negotiatedFinalPrice?: number
  agentCommissionPercent?: number
  agentCommissionAmount?: number
  stampDutyPrice?: number
  agreementPrice?: number
  currency: string
  createdAt: string
  updatedAt: string
  /** Set when sale + payments are shared across multiple plots. */
  combinedGroupId?: string
  combinedDisplayName?: string
  combinedPlotIds?: string[]
  /** When true, payment lines are read-only until unlocked (solo or combined sale). */
  paymentsLocked?: boolean
}

/** Multi-plot combined buyer deal (shared sale line + one payment history). */
export interface CombinedPlotSaleGroup {
  id: string
  projectId: string
  displayName: string
  plotIds: string[]
  purchaserName?: string
  subregistrarRegistrationDate?: string
  negotiatedFinalPrice?: number
  agentCommissionPercent?: number
  agentCommissionAmount?: number
  stampDutyPrice?: number
  agreementPrice?: number
  currency: string
  createdAt: string
  updatedAt: string
  paymentsLocked?: boolean
}

/** Buyer payment toward a plot sale. */
export interface PlotSalePayment {
  id: string
  /** Set for a standalone plot payment. */
  plotId?: string
  /** Set for a combined multi-plot payment. */
  saleGroupId?: string
  paymentMode: string
  paidDate: string
  amount?: number
  notes?: string
  /** Ledger account where the payment was received (optional). */
  accountId?: string
  /** Buyer lines only: refund to purchaser (reduces net received). */
  isRefund?: boolean
  createdAt: string
  updatedAt: string
}

/** Commission paid to the selling agent (same shape as buyer payment lines). */
export type PlotSaleAgentPayment = PlotSalePayment

export type PlotSaleReportKind = 'fiscal' | 'activity'

/** One row in a plot sale fiscal or activity export. */
export interface PlotSaleReportRow {
  /** Single-plot id, or combined sale group id when `isCombinedSale` is true. */
  plotId: string
  plotNumber: string | null
  purchaserName: string | null
  /** ISO date YYYY-MM-DD */
  subregistrarRegistrationDate: string | null
  negotiatedFinalPrice: number | null
  currency: string
  combinedGroupId: string | null
  /** True when this row is one combined multi-plot purchase (plot numbers aggregated). */
  isCombinedSale: boolean
  /** Net buyer receipts per payment mode (refunds subtract). */
  paymentTotalsByMode: Record<string, number>
}

export interface PlotSaleReportResponse {
  report: PlotSaleReportKind
  startDate: string
  endDate: string
  projectId: string
  rows: PlotSaleReportRow[]
  note: string
}

export type VendorKind = 'company' | 'person' | 'government'

export interface Vendor {
  id: string
  projectId: string
  name: string
  vendorKind: VendorKind
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
  glAccountId?: string
}

/** PATCH body: `dueDate: null` clears the due date; `glAccountId: null` clears GL on the server. */
export type InvoiceUpdatePatch = Partial<
  Pick<Invoice, 'vendorId' | 'invoiceNumber' | 'amount' | 'currency' | 'issuedDate' | 'status'>
> & { dueDate?: string | null; glAccountId?: string | null }

export type PaymentSourceKind = 'account' | 'cash' | 'other'
/** Invoice payments may combine funding sources (stored as `mixed` when more than one). */
export type InvoicePaymentSourceKind = PaymentSourceKind | 'mixed'

export interface PaymentAdvanceAllocation {
  advanceId: string
  amount: number
}

export interface GlCategory {
  id: string
  code: string
  name: string
  sortOrder: number
}

/** User-defined grouping under a top-level GL category (e.g. Current assets, Operating expenses). */
export interface GlSubcategory {
  id: string
  glCategoryId: string
  code: string
  name: string
  sortOrder: number
}

export interface GlAccount {
  id: string
  glCategoryId: string
  categoryCode?: string
  categoryName?: string
  glSubcategoryId?: string
  subcategoryCode?: string
  subcategoryName?: string
  code: string
  name: string
  isActive: boolean
}

export interface GeneralLedgerEntry {
  id: string
  projectId: string
  entryDate: string
  glAccountId: string
  accountCode?: string
  accountName?: string
  debit: number
  credit: number
  memo?: string
  sourceKind: string
  sourceId: string
  createdAt: string
}

export interface VendorDisbursementLine {
  id: string
  batchId: string
  partyName: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  invoiceNumber?: string
  dueAmount?: number
  paidAmount: number
  datePaid?: string
  gstAmount?: number
  notes?: string
  glAccountId?: string
}

export interface VendorDisbursementBatch {
  id: string
  projectId: string
  vendorId: string
  /** When set, this lump-sum payout is scoped to the parent vendor invoice (subcontractor charges). */
  invoiceId?: string
  lumpSumAmount: number
  currency: string
  paidToContractorDate: string
  paymentSourceKind: PaymentSourceKind
  sourceAccountId?: string
  reference?: string
  notes?: string
  glAccountId: string
  createdAt: string
  lines?: VendorDisbursementLine[]
}

export interface VendorAdvanceUsage {
  id: string
  advanceId: string
  usageDate: string
  description: string
  amount: number
  invoiceNumber?: string
  gstAmount?: number
  notes?: string
  glAccountId?: string
}

export interface VendorAdvance {
  id: string
  projectId: string
  vendorId: string
  amount: number
  currency: string
  paidDate: string
  paymentSourceKind: PaymentSourceKind
  sourceAccountId?: string
  reference?: string
  notes?: string
  prepaidGlAccountId: string
  createdAt: string
  remainingBalance?: number
  usages?: VendorAdvanceUsage[]
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
  paymentSourceKind?: InvoicePaymentSourceKind
  sourceAccountId?: string
  glAccountId?: string
  /** Bank / operating account portion (maps to GL bank clearing). */
  fromAccountAmount?: number
  fromCashAmount?: number
  fromOtherAmount?: number
  advanceAllocations?: PaymentAdvanceAllocation[]
}

/** Payment row + project label for account transaction linking (Accounts page). */
export type TransactionPaymentOption = {
  payment: Payment
  projectId: string
  projectName: string
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

/** Optional filters for GET …/accounts/:id/transactions */
export type AccountTransactionListFilters = {
  occurredOnFrom?: string
  occurredOnTo?: string
  /** Restrict to lines tagged with this project (matches `project_id` on the transaction). */
  projectId?: string
  descriptionContains?: string
  bankMemoContains?: string
  transactionCategoryContains?: string
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
  /** Comma-separated plot numbers from linked project plots (for display). */
  plotNumberLabels?: string
  occurredOn: string
  paymentId?: string
  createdAt: string
}

export const ACCOUNT_FIXED_DEPOSIT_STATUSES = [
  'active',
  'cashed_pre_maturity',
  'matured',
  'matured_rolled_over',
] as const

export type AccountFixedDepositStatus = (typeof ACCOUNT_FIXED_DEPOSIT_STATUSES)[number]

export const ACCOUNT_FIXED_DEPOSIT_STATUS_LABELS: Record<AccountFixedDepositStatus, string> = {
  active: 'Active',
  cashed_pre_maturity: 'Cashed - Pre-maturity',
  matured: 'Matured',
  matured_rolled_over: 'Matured - Rolled over',
}

/** Fixed deposit / investment certificate; interest figures computed by API (365-day simple interest). */
export interface AccountFixedDeposit {
  id: string
  accountId: string
  certificateNumber: string
  effectiveDate: string
  principalAmount: number
  annualRatePercent: number
  maturityValue: number
  maturityDate: string
  status: AccountFixedDepositStatus
  notes?: string
  createdAt: string
  updatedAt: string
  dailyInterest: number
  daysElapsed: number
  accruedInterest: number
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
