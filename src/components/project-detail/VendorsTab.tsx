import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Invoice, Payment, Vendor, VendorAdvance } from '../../types'

function vendorKindLabel(k: Vendor['vendorKind']): string {
  if (k === 'person') return 'Person'
  if (k === 'government') return 'Government'
  return 'Company'
}
import { formatDate, formatMoney } from '../../utils/format'
import { InvoiceRecordPanel } from '../InvoiceRecordPanel'
import { PaymentRecordPanel } from '../PaymentRecordPanel'
import { VendorAddPanel } from '../VendorAddPanel'
import { VendorDisbursementsAdvancesSection } from './VendorDisbursementsAdvancesSection'

const iconBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

export function VendorsTab({
  projectId,
  vendors,
  invoices,
  payments,
  vendorName,
  onRefresh,
  onError,
  readOnly = false,
}: {
  projectId: string
  vendors: Vendor[]
  invoices: Invoice[]
  payments: Payment[]
  vendorName: Map<string, string>
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  readOnly?: boolean
}) {
  const [panelMode, setPanelMode] = useState<'vendor' | 'invoice' | 'payment' | null>(null)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [displayInvoices, setDisplayInvoices] = useState<Invoice[]>(invoices)
  const [displayPayments, setDisplayPayments] = useState<Payment[]>(payments)
  const [vendorAdvances, setVendorAdvances] = useState<VendorAdvance[]>([])

  const actionsDisabled = readOnly

  const vendorBalances = useMemo(() => {
    return vendors.map((v) => {
      const invoiced = invoices.filter((i) => i.vendorId === v.id).reduce((s, i) => s + i.amount, 0)
      const paid = payments.filter((p) => p.vendorId === v.id).reduce((s, p) => s + p.amount, 0)
      const advancePool = vendorAdvances
        .filter((a) => a.vendorId === v.id)
        .reduce((s, a) => s + (a.remainingBalance ?? 0), 0)
      return {
        vendor: v,
        invoiced,
        paid,
        apBalance: invoiced - paid,
        advancePool,
      }
    })
  }, [vendors, invoices, payments, vendorAdvances])

  const closePanel = () => {
    setPanelMode(null)
    setEditingVendor(null)
    setEditingInvoice(null)
    setEditingPayment(null)
  }

  const invoicesById = useMemo(() => {
    const m = new Map<string, Invoice>()
    invoices.forEach((i) => m.set(i.id, i))
    return m
  }, [invoices])

  const paymentInvoiceOptions =
    editingPayment != null ? invoices : selectedVendorId ? displayInvoices : invoices

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

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const adv = await api.listVendorAdvances(projectId)
        if (!ignore) setVendorAdvances(adv)
      } catch {
        if (!ignore) setVendorAdvances([])
      }
    })()
    return () => {
      ignore = true
    }
  }, [projectId, payments.length])

  return (
    <div className="space-y-10">
      {readOnly ? (
        <p className="text-xs text-amber-800/90">View-only: vendor and billing changes are disabled.</p>
      ) : null}

      <section>
        <h2 className="text-lg font-medium text-slate-900">Vendor balances</h2>
        <p className="mt-1 text-xs text-slate-500">
          A/P balance = invoiced − paid (negative means overpaid). Advance pool = unused vendor prepayments
          remaining.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Invoiced</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">A/P balance</th>
                <th className="px-4 py-3">Advance pool</th>
              </tr>
            </thead>
            <tbody>
              {vendorBalances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No vendors.
                  </td>
                </tr>
              ) : (
                vendorBalances.map((row) => (
                  <tr key={row.vendor.id} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-900">{row.vendor.name}</td>
                    <td className="px-4 py-2 text-slate-600">{vendorKindLabel(row.vendor.vendorKind)}</td>
                    <td className="px-4 py-2">{formatMoney(row.invoiced)}</td>
                    <td className="px-4 py-2">{formatMoney(row.paid)}</td>
                    <td
                      className={`px-4 py-2 font-medium ${
                        row.apBalance > 0 ? 'text-amber-800' : row.apBalance < 0 ? 'text-teal-800' : 'text-slate-700'
                      }`}
                    >
                      {formatMoney(row.apBalance)}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{formatMoney(row.advancePool)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {panelMode !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            {panelMode === 'vendor' ? (
              <VendorAddPanel
                projectId={projectId}
                initialVendor={editingVendor}
                onClose={closePanel}
                onRefresh={onRefresh}
                onError={onError}
                className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
              />
            ) : panelMode === 'invoice' ? (
              <InvoiceRecordPanel
                projectId={projectId}
                vendors={vendors}
                initialInvoice={editingInvoice}
                onClose={closePanel}
                onRefresh={onRefresh}
                onError={onError}
                className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
              />
            ) : (
              <PaymentRecordPanel
                projectId={projectId}
                invoices={paymentInvoiceOptions}
                payments={payments}
                vendorAdvances={vendorAdvances}
                vendorName={vendorName}
                initialPayment={editingPayment}
                onClose={closePanel}
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
          {!readOnly ? (
            <button
              type="button"
              onClick={() => {
                setEditingVendor(null)
                setEditingInvoice(null)
                setEditingPayment(null)
                setPanelMode('vendor')
              }}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Add vendor
            </button>
          ) : null}
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-11 min-w-[2.75rem] px-2 py-3">Actions</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="w-11 min-w-[2.75rem] px-2 py-3">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
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
                    <td
                      className="whitespace-nowrap px-2 py-3 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        title="Edit vendor"
                        aria-label="Edit vendor"
                        disabled={actionsDisabled}
                        className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                        onClick={() => {
                          setEditingInvoice(null)
                          setEditingPayment(null)
                          setEditingVendor(v)
                          setPanelMode('vendor')
                        }}
                      >
                        <PencilIcon />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                    <td className="px-4 py-3 text-slate-600">{vendorKindLabel(v.vendorKind)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.contactName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.email ?? '—'}</td>
                    <td
                      className="whitespace-nowrap px-2 py-3 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        title="Delete vendor"
                        aria-label="Delete vendor"
                        disabled={actionsDisabled}
                        className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
                        onClick={() => {
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
                        <TrashIcon />
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
          {!readOnly ? (
            <button
              type="button"
              onClick={() => {
                setEditingVendor(null)
                setEditingInvoice(null)
                setEditingPayment(null)
                setPanelMode('invoice')
              }}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Record invoice
            </button>
          ) : null}
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-11 min-w-[2.75rem] px-2 py-3">Actions</th>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-11 min-w-[2.75rem] px-2 py-3">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No invoices.
                  </td>
                </tr>
              ) : (
                displayInvoices.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-2 py-3 align-middle">
                      <button
                        type="button"
                        title="Edit invoice"
                        aria-label="Edit invoice"
                        disabled={actionsDisabled}
                        className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                        onClick={() => {
                          setEditingVendor(null)
                          setEditingPayment(null)
                          setEditingInvoice(i)
                          setPanelMode('invoice')
                        }}
                      >
                        <PencilIcon />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{i.invoiceNumber}</td>
                    <td className="px-4 py-3">{vendorName.get(i.vendorId) ?? '—'}</td>
                    <td className="px-4 py-3">{formatMoney(i.amount, i.currency)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(i.issuedDate)}
                    </td>
                    <td className="px-4 py-3 capitalize">{i.status.replace('_', ' ')}</td>
                    <td className="whitespace-nowrap px-2 py-3 align-middle">
                      <button
                        type="button"
                        title="Delete invoice"
                        aria-label="Delete invoice"
                        disabled={actionsDisabled}
                        className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
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
                        <TrashIcon />
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
          {!readOnly ? (
            <button
              type="button"
              onClick={() => {
                setEditingVendor(null)
                setEditingInvoice(null)
                setEditingPayment(null)
                setPanelMode('payment')
              }}
              className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900"
            >
              Record payment
            </button>
          ) : null}
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-11 min-w-[2.75rem] px-2 py-3">Actions</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Partial</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Comments</th>
                <th className="w-11 min-w-[2.75rem] px-2 py-3">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayPayments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                    No payments.
                  </td>
                </tr>
              ) : (
                displayPayments.map((p) => {
                  const inv = invoicesById.get(p.invoiceId)
                  return (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="whitespace-nowrap px-2 py-3 align-middle">
                        <button
                          type="button"
                          title="Edit payment"
                          aria-label="Edit payment"
                          disabled={actionsDisabled}
                          className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                          onClick={() => {
                            setEditingVendor(null)
                            setEditingInvoice(null)
                            setEditingPayment(p)
                            setPanelMode('payment')
                          }}
                        >
                          <PencilIcon />
                        </button>
                      </td>
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
                      <td className="whitespace-nowrap px-2 py-3 align-middle">
                        <button
                          type="button"
                          title="Delete payment"
                          aria-label="Delete payment"
                          disabled={actionsDisabled}
                          className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
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
                          <TrashIcon />
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

      <VendorDisbursementsAdvancesSection
        projectId={projectId}
        vendorName={vendorName}
        onRefresh={onRefresh}
        onError={onError}
        readOnly={readOnly}
      />
    </div>
  )
}
