import type { Invoice } from '../types'

export function invoiceGstAmount(inv: Pick<Invoice, 'gstAmount'>): number {
  return inv.gstAmount ?? 0
}

/** Payable total: net + GST. */
export function invoiceTotalWithGst(inv: Pick<Invoice, 'amount' | 'gstAmount'>): number {
  return inv.amount + invoiceGstAmount(inv)
}
