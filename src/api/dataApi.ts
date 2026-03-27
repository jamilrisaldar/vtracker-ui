/**
 * Domain data: real backend when `VITE_USE_BACKEND_AUTH` is set, else local mock.
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
  LandPlot,
  Payment,
  Phase,
  PhaseStatus,
  PlotStatus,
  Project,
  ProjectDocument,
  CombinedPlotSaleGroup,
  PlotSale,
  PlotSaleAgentPayment,
  PlotSalePayment,
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
  notes?: string
  startDate: string
  endDate: string
  status?: PhaseStatus
  estimatedTotal?: number
  actualSpend?: number
}): Promise<Phase> {
  if (isBackendAuthEnabled()) return backend.createPhase(input)
  return mock.createPhase(input)
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

export async function listPlots(projectId: string): Promise<LandPlot[]> {
  if (isBackendAuthEnabled()) return backend.listPlots(projectId)
  return mock.listPlots(projectId)
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
  if (isBackendAuthEnabled()) return backend.createPlot(input)
  return mock.createPlot(input)
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
  if (isBackendAuthEnabled()) return backend.updatePlot(plotId, projectId, patch)
  return mock.updatePlot(plotId, projectId, patch)
}

export async function deletePlot(plotId: string, projectId: string): Promise<void> {
  if (isBackendAuthEnabled()) return backend.deletePlot(plotId, projectId)
  return mock.deletePlot(plotId, projectId)
}

export async function getPlotSale(plotId: string, projectId: string): Promise<PlotSale | null> {
  if (isBackendAuthEnabled()) return backend.getPlotSale(plotId, projectId)
  return mock.getPlotSale(plotId, projectId)
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
  if (isBackendAuthEnabled()) return backend.upsertPlotSale(plotId, projectId, body)
  return mock.upsertPlotSale(plotId, projectId, body)
}

export async function listPlotSalePayments(
  plotId: string,
  projectId: string,
): Promise<PlotSalePayment[]> {
  if (isBackendAuthEnabled()) return backend.listPlotSalePayments(plotId, projectId)
  return mock.listPlotSalePayments(plotId, projectId)
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
  if (isBackendAuthEnabled()) return backend.createPlotSalePayment(plotId, projectId, input)
  return mock.createPlotSalePayment(plotId, projectId, input)
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
  if (isBackendAuthEnabled()) {
    return backend.updatePlotSalePayment(plotId, paymentId, projectId, patch)
  }
  return mock.updatePlotSalePayment(plotId, paymentId, projectId, patch)
}

export async function deletePlotSalePayment(
  plotId: string,
  paymentId: string,
  projectId: string,
): Promise<void> {
  if (isBackendAuthEnabled()) {
    return backend.deletePlotSalePayment(plotId, paymentId, projectId)
  }
  return mock.deletePlotSalePayment(plotId, paymentId, projectId)
}

export async function listPlotSaleAgentPayments(
  plotId: string,
  projectId: string,
): Promise<PlotSaleAgentPayment[]> {
  if (isBackendAuthEnabled()) return backend.listPlotSaleAgentPayments(plotId, projectId)
  return mock.listPlotSaleAgentPayments(plotId, projectId)
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
  if (isBackendAuthEnabled()) return backend.createPlotSaleAgentPayment(plotId, projectId, input)
  return mock.createPlotSaleAgentPayment(plotId, projectId, input)
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
  if (isBackendAuthEnabled()) {
    return backend.updatePlotSaleAgentPayment(plotId, agentPaymentId, projectId, patch)
  }
  return mock.updatePlotSaleAgentPayment(plotId, agentPaymentId, projectId, patch)
}

export async function deletePlotSaleAgentPayment(
  plotId: string,
  agentPaymentId: string,
  projectId: string,
): Promise<void> {
  if (isBackendAuthEnabled()) {
    return backend.deletePlotSaleAgentPayment(plotId, agentPaymentId, projectId)
  }
  return mock.deletePlotSaleAgentPayment(plotId, agentPaymentId, projectId)
}

export async function createCombinedPlotSaleGroup(input: {
  projectId: string
  displayName?: string
  plotIds: string[]
}): Promise<CombinedPlotSaleGroup> {
  if (isBackendAuthEnabled()) return backend.createCombinedPlotSaleGroup(input)
  return mock.createCombinedPlotSaleGroup(input)
}

export async function getCombinedPlotSaleGroup(
  groupId: string,
  projectId: string,
): Promise<CombinedPlotSaleGroup> {
  if (isBackendAuthEnabled()) return backend.getCombinedPlotSaleGroup(groupId, projectId)
  return mock.getCombinedPlotSaleGroup(groupId, projectId)
}

export async function updateCombinedPlotSaleGroup(
  groupId: string,
  projectId: string,
  patch: { displayName?: string; plotIds?: string[] },
): Promise<CombinedPlotSaleGroup> {
  if (isBackendAuthEnabled()) {
    return backend.updateCombinedPlotSaleGroup(groupId, projectId, patch)
  }
  return mock.updateCombinedPlotSaleGroup(groupId, projectId, patch)
}

export async function deleteCombinedPlotSaleGroup(
  groupId: string,
  projectId: string,
): Promise<void> {
  if (isBackendAuthEnabled()) {
    return backend.deleteCombinedPlotSaleGroup(groupId, projectId)
  }
  return mock.deleteCombinedPlotSaleGroup(groupId, projectId)
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

export async function listInvoicesByVendor(projectId: string, vendorId: string): Promise<Invoice[]> {
  if (isBackendAuthEnabled()) return backend.listInvoicesByVendor(projectId, vendorId)
  return mock.listInvoicesByVendor(projectId, vendorId)
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

export async function listPaymentsByVendor(projectId: string, vendorId: string): Promise<Payment[]> {
  if (isBackendAuthEnabled()) return backend.listPaymentsByVendor(projectId, vendorId)
  return mock.listPaymentsByVendor(projectId, vendorId)
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

export async function listAccounts(): Promise<Account[]> {
  if (isBackendAuthEnabled()) return backend.listAccounts()
  return mock.listAccounts()
}

export async function createAccount(input: {
  kind: 'bank' | 'cash'
  name: string
  currency?: string
  accountLocation?: string
  projectId?: string
}): Promise<Account> {
  if (isBackendAuthEnabled()) return backend.createAccount(input)
  return mock.createAccount(input)
}

export async function updateAccount(
  accountId: string,
  patch: Partial<Pick<Account, 'kind' | 'name' | 'currency' | 'accountLocation' | 'projectId'>>,
): Promise<Account> {
  if (isBackendAuthEnabled()) return backend.updateAccount(accountId, patch)
  return mock.updateAccount(accountId, patch)
}

export async function deleteAccount(accountId: string): Promise<void> {
  if (isBackendAuthEnabled()) return backend.deleteAccount(accountId)
  return mock.deleteAccount(accountId)
}

export async function listAccountTransactions(
  accountId: string,
  filters?: AccountTransactionListFilters,
): Promise<AccountTransaction[]> {
  if (isBackendAuthEnabled()) return backend.listAccountTransactions(accountId, filters)
  return mock.listAccountTransactions(accountId, filters)
}

export type { AccountTransactionListFilters } from '../types'

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
  if (isBackendAuthEnabled()) return backend.createAccountTransaction(input)
  return mock.createAccountTransaction(input)
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
  if (isBackendAuthEnabled()) return backend.updateAccountTransaction(transactionId, accountId, patch)
  return mock.updateAccountTransaction(transactionId, accountId, patch)
}

export async function listAccountTransactionCategories(): Promise<string[]> {
  if (isBackendAuthEnabled()) return backend.listAccountTransactionCategories()
  return mock.listAccountTransactionCategories()
}

export async function deleteAccountTransaction(
  transactionId: string,
  accountId: string,
): Promise<void> {
  if (isBackendAuthEnabled()) return backend.deleteAccountTransaction(transactionId, accountId)
  return mock.deleteAccountTransaction(transactionId, accountId)
}

export async function listAccountFixedDeposits(accountId: string): Promise<AccountFixedDeposit[]> {
  if (isBackendAuthEnabled()) return backend.listAccountFixedDeposits(accountId)
  return mock.listAccountFixedDeposits(accountId)
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
  if (isBackendAuthEnabled()) return backend.createAccountFixedDeposit(input)
  return mock.createAccountFixedDeposit(input)
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
  if (isBackendAuthEnabled()) return backend.updateAccountFixedDeposit(depositId, accountId, patch)
  return mock.updateAccountFixedDeposit(depositId, accountId, patch)
}

export async function deleteAccountFixedDeposit(depositId: string, accountId: string): Promise<void> {
  if (isBackendAuthEnabled()) return backend.deleteAccountFixedDeposit(depositId, accountId)
  return mock.deleteAccountFixedDeposit(depositId, accountId)
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
