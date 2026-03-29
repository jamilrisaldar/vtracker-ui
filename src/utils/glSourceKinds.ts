/** Must match `GL_SOURCE_KINDS` in vtracker-api `glConstants.ts`. */
export const GL_SOURCE_KINDS = {
  manualJournal: 'manual_journal',
  vendorInvoice: 'vendor_invoice',
  vendorInvoicePayment: 'vendor_invoice_payment',
  vendorDisbursementBatch: 'vendor_disbursement_batch',
  vendorAdvance: 'vendor_advance',
  vendorAdvanceUsage: 'vendor_advance_usage',
} as const
