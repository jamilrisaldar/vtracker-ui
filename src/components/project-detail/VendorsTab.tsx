import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Invoice, Payment, Vendor } from '../../types'
import { formatDate, formatMoney } from '../../utils/format'
import { InvoiceRecordPanel } from '../InvoiceRecordPanel'
import { PaymentRecordPanel } from '../PaymentRecordPanel'
import { VendorAddPanel } from '../VendorAddPanel'

export function VendorsTab({
  projectId,
  vendors,
  invoices,
  payments,
  vendorName,
  onRefresh,
  onError,
}: {
  projectId: string
  vendors: Vendor[]
  invoices: Invoice[]
  payments: Payment[]
  vendorName: Map<string, string>
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
}) {
  const [panelMode, setPanelMode] = useState<'vendor' | 'invoice' | 'payment' | null>(null)
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [displayInvoices, setDisplayInvoices] = useState<Invoice[]>(invoices)
  const [displayPayments, setDisplayPayments] = useState<Payment[]>(payments)

  const invoicesById = useMemo(() => {
    const m = new Map<string, Invoice>()
    displayInvoices.forEach((i) => m.set(i.id, i))
    return m
  }, [displayInvoices])

  useEffect(() => {
    if (!selectedVendorId) {
      setDisplayInvoices(invoices)
      setDisplayPayments(payments)
    }
  }, [invoices, payments, selectedVendorId])

  useEffect(() => {
    let ignore = false
    if (!selectedVendorId) return
    void (async () => {
      try {
        onError(null)
        const [inv, pay] = await Promise.all([
          api.listInvoicesByVendor(projectId, selectedVendorId),
          api.listPaymentsByVendor(projectId, selectedVendorId),
        ])
        if (ignore) return
        setDisplayInvoices(inv)
        setDisplayPayments(pay)
      } catch (err) {
        if (ignore) return
        onError(err instanceof Error ? err.message : 'Could not filter vendor data.')
      }
    })()
    return () => {
      ignore = true
    }
  }, [projectId, selectedVendorId, onError])

  return (
    <div className="space-y-10">
      {panelMode !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            {panelMode === 'vendor' ? (
              <VendorAddPanel
                projectId={projectId}
                onClose={() => setPanelMode(null)}
                onRefresh={onRefresh}
                onError={onError}
                className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
              />
            ) : panelMode === 'invoice' ? (
              <InvoiceRecordPanel
                projectId={projectId}
                vendors={vendors}
                onClose={() => setPanelMode(null)}
                onRefresh={onRefresh}
                onError={onError}
                className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
              />
            ) : (
              <PaymentRecordPanel
                projectId={projectId}
                invoices={selectedVendorId ? displayInvoices : invoices}
                vendorName={vendorName}
                onClose={() => setPanelMode(null)}
                onRefresh={onRefresh}
                onError={onError}
                className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
              />
            )}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium text-slate-900">Vendors</h2>
            {selectedVendorId && (
              <button
                type="button"
                onClick={() => setSelectedVendorId(null)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Show all
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPanelMode('vendor')}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Add vendor
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No vendors yet.
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr
                    key={v.id}
                    className={[
                      'cursor-pointer border-b border-slate-100',
                      selectedVendorId === v.id ? 'bg-teal-50' : 'hover:bg-slate-50',
                    ].join(' ')}
                    onClick={() =>
                      setSelectedVendorId((curr) => (curr === v.id ? null : v.id))
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.contactName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.email ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!confirm('Delete vendor and related invoice links?')) return
                          void (async () => {
                            try {
                              await api.deleteVendor(v.id, projectId)
                              if (selectedVendorId === v.id) setSelectedVendorId(null)
                              await onRefresh()
                            } catch (err) {
                              onError(err instanceof Error ? err.message : 'Delete failed.')
                            }
                          })()
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">Invoices</h2>
          <button
            type="button"
            onClick={() => setPanelMode('invoice')}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Record invoice
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displayInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No invoices.
                  </td>
                </tr>
              ) : (
                displayInvoices.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{i.invoiceNumber}</td>
                    <td className="px-4 py-3">{vendorName.get(i.vendorId) ?? '—'}</td>
                    <td className="px-4 py-3">{formatMoney(i.amount, i.currency)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(i.issuedDate)}
                    </td>
                    <td className="px-4 py-3 capitalize">{i.status.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          if (!confirm('Delete this invoice?')) return
                          void (async () => {
                            try {
                              await api.deleteInvoice(i.id, projectId)
                              await onRefresh()
                            } catch (err) {
                              onError(err instanceof Error ? err.message : 'Delete failed.')
                            }
                          })()
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">Payments</h2>
          <button
            type="button"
            onClick={() => setPanelMode('payment')}
            className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900"
          >
            Record payment
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Partial</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Comments</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displayPayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                    No payments.
                  </td>
                </tr>
              ) : (
                displayPayments.map((p) => {
                  const inv = invoicesById.get(p.invoiceId)
                  return (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="px-4 py-3">{formatDate(p.paidDate)}</td>
                      <td className="px-4 py-3">
                        {vendorName.get(p.vendorId) ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {inv?.invoiceNumber ?? p.invoiceId}
                      </td>
                      <td className="px-4 py-3">
                        {inv
                          ? formatMoney(p.amount, inv.currency)
                          : formatMoney(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.paymentMethod ?? p.method ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.isPaymentPartial ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.paymentSource ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.reference ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.comments ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => {
                            if (!confirm('Delete this payment?')) return
                            void (async () => {
                              try {
                                await api.deletePayment(p.id, projectId)
                                await onRefresh()
                              } catch (err) {
                                onError(err instanceof Error ? err.message : 'Delete failed.')
                              }
                            })()
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
