import type { Invoice } from '../types'

/** Central GST (CGST); API field `gstAmount`. */
export function invoiceCentralGstAmount(inv: Pick<Invoice, 'gstAmount'>): number {
  return inv.gstAmount ?? 0
}

/** State GST (SGST). */
export function invoiceStateGstAmount(inv: Pick<Invoice, 'stateGstAmount'>): number {
  return inv.stateGstAmount ?? 0
}

/** Total GST = Central + State. */
export function invoiceGstAmount(inv: Pick<Invoice, 'gstAmount' | 'stateGstAmount'>): number {
  return invoiceCentralGstAmount(inv) + invoiceStateGstAmount(inv)
}

/** Payable total: net + Central GST + State GST. */
export function invoiceTotalWithGst(inv: Pick<Invoice, 'amount' | 'gstAmount' | 'stateGstAmount'>): number {
  return inv.amount + invoiceGstAmount(inv)
}
