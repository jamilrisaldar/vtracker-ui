import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Invoice, Payment, Vendor, VendorAdvance } from '../../types'
import { formatDate } from '../../utils/format'
import { MoneyAmount } from '../MoneyAmount'
import {
  invoiceCentralGstAmount,
  invoiceStateGstAmount,
  invoiceTotalWithGst,
} from '../../utils/invoiceTotals'
import { InvoiceRecordPanel } from '../InvoiceRecordPanel'
import { PaymentRecordPanel } from '../PaymentRecordPanel'
import { VendorAddPanel } from '../VendorAddPanel'
import { VendorDisbursementsAdvancesSection } from './VendorDisbursementsAdvancesSection'
import { VendorBillingGlIconButton, VendorBillingGlModal, type VendorBillingGlSection } from '../VendorBillingGlModal'
import { GL_SOURCE_KINDS } from '../../utils/glSourceKinds'

function vendorKindLabel(k: Vendor['vendorKind']): string {
  if (k === 'person') return 'Person'
  if (k === 'government') return 'Government'
  return 'Company'
}

/** Vendor invoice table: paid (green), partial (lighter green), outstanding sent/overdue (light orange), draft neutral. */
function invoiceTableRowClass(status: Invoice['status']): string {
  const base = 'border-b border-slate-200/80 transition-colors'
  if (status === 'paid') return `${base} bg-emerald-100/90 hover:bg-emerald-100`
  if (status === 'partial') return `${base} bg-emerald-50/95 hover:bg-emerald-50`
  if (status === 'sent' || status === 'overdue') return `${base} bg-orange-50/95 hover:bg-orange-50/90`
  return `${base} bg-white hover:bg-slate-50/90`
}

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

function CopyInvoiceIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

function RecordPaymentIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
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
  const [detailVendorId, setDetailVendorId] = useState<string | null>(null)
  const [displayInvoices, setDisplayInvoices] = useState<Invoice[]>([])
  const [displayPayments, setDisplayPayments] = useState<Payment[]>([])
  const [vendorAdvances, setVendorAdvances] = useState<VendorAdvance[]>([])
  /** Prefill new-invoice drawer from an existing row (vendor detail: copy invoice). */
  const [invoiceCopyTemplate, setInvoiceCopyTemplate] = useState<Invoice | null>(null)
  /** When opening Record payment from an invoice row, pre-select that invoice in the panel. */
  const [paymentPrefillInvoiceId, setPaymentPrefillInvoiceId] = useState<string | null>(null)

  const [glModalOpen, setGlModalOpen] = useState(false)
  const [glModalTitle, setGlModalTitle] = useState('')
  const [glModalSections, setGlModalSections] = useState<VendorBillingGlSection[]>([])
  const [glModalLoading, setGlModalLoading] = useState(false)
  const [glModalError, setGlModalError] = useState<string | null>(null)

  const actionsDisabled = readOnly

  const detailVendor = useMemo(
    () => (detailVendorId ? vendors.find((v) => v.id === detailVendorId) ?? null : null),
    [vendors, detailVendorId],
  )

  const detailBalances = useMemo(() => {
    if (!detailVendorId) return null
    const invoiced = invoices
      .filter((i) => i.vendorId === detailVendorId)
      .reduce((s, i) => s + invoiceTotalWithGst(i), 0)
    const paid = payments.filter((p) => p.vendorId === detailVendorId).reduce((s, p) => s + p.amount, 0)
    const advancePool = vendorAdvances
      .filter((a) => a.vendorId === detailVendorId)
      .reduce((s, a) => s + (a.remainingBalance ?? 0), 0)
    return { invoiced, paid, apBalance: invoiced - paid, advancePool }
  }, [detailVendorId, invoices, payments, vendorAdvances])

  const closePanel = () => {
    setPanelMode(null)
    setEditingVendor(null)
    setEditingInvoice(null)
    setEditingPayment(null)
    setPaymentPrefillInvoiceId(null)
    setInvoiceCopyTemplate(null)
  }

  const invoicesById = useMemo(() => {
    const m = new Map<string, Invoice>()
    for (const i of invoices) m.set(i.id, i)
    for (const i of displayInvoices) m.set(i.id, i)
    return m
  }, [invoices, displayInvoices])

  const closeGlModal = () => {
    setGlModalOpen(false)
    setGlModalError(null)
    setGlModalSections([])
  }

  const openInvoiceGlModal = (i: Invoice) => {
    void (async () => {
      setGlModalTitle(`GL entries — Invoice ${i.invoiceNumber}`)
      setGlModalOpen(true)
      setGlModalLoading(true)
      setGlModalError(null)
      setGlModalSections([])
      try {
        const entries = await api.listGeneralLedgerEntries(projectId, {
          sourceKind: GL_SOURCE_KINDS.vendorInvoice,
          sourceId: i.id,
        })
        setGlModalSections([{ title: 'Invoice accrual', subtitle: `Invoice ${i.invoiceNumber}`, entries }])
      } catch (e) {
        setGlModalError(e instanceof Error ? e.message : 'Could not load GL entries.')
      } finally {
        setGlModalLoading(false)
      }
    })()
  }

  const openPaymentGlModal = (p: Payment, inv: Invoice | undefined) => {
    void (async () => {
      const invLabel = inv?.invoiceNumber ?? p.invoiceId
      setGlModalTitle(`GL entries — Payment (${invLabel})`)
      setGlModalOpen(true)
      setGlModalLoading(true)
      setGlModalError(null)
      setGlModalSections([])
      try {
        const [invEntries, payEntries] = await Promise.all([
          api.listGeneralLedgerEntries(projectId, {
            sourceKind: GL_SOURCE_KINDS.vendorInvoice,
            sourceId: p.invoiceId,
          }),
          api.listGeneralLedgerEntries(projectId, {
            sourceKind: GL_SOURCE_KINDS.vendorInvoicePayment,
            sourceId: p.id,
          }),
        ])
        setGlModalSections([
          {
            title: 'Related invoice (accrual)',
            subtitle: inv ? `Invoice ${inv.invoiceNumber}` : undefined,
            entries: invEntries,
          },
          { title: 'This payment (expense / clearing / prepaid)', entries: payEntries },
        ])
      } catch (e) {
        setGlModalError(e instanceof Error ? e.message : 'Could not load GL entries.')
      } finally {
        setGlModalLoading(false)
      }
    })()
  }

  const paymentInvoiceOptions =
    editingPayment != null ? invoices : detailVendorId ? displayInvoices : invoices

  useEffect(() => {
    if (!detailVendorId) {
      setDisplayInvoices([])
      setDisplayPayments([])
    }
  }, [detailVendorId])

  useEffect(() => {
    let ignore = false
    if (!detailVendorId) return
    void (async () => {
      try {
        onError(null)
        const [inv, pay, adv] = await Promise.all([
          api.listInvoicesByVendor(projectId, detailVendorId),
          api.listPaymentsByVendor(projectId, detailVendorId),
          api.listVendorAdvances(projectId),
        ])
        if (ignore) return
        setDisplayInvoices(inv)
        setDisplayPayments(pay)
        setVendorAdvances(adv)
      } catch (err) {
        if (ignore) return
        onError(err instanceof Error ? err.message : 'Could not load vendor data.')
      }
    })()
    return () => {
      ignore = true
    }
  }, [projectId, detailVendorId, onError])

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
    <div className="space-y-6">
      {readOnly ? (
        <p className="text-xs text-amber-800/90">View-only: vendor and billing changes are disabled.</p>
      ) : null}

      {detailVendorId != null && detailVendor ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{detailVendor.name}</h2>
              <p className="mt-0.5 text-sm text-slate-600">{vendorKindLabel(detailVendor.vendorKind)}</p>
              {detailBalances ? (
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
                  <div>
                    <dt className="inline text-slate-600">Invoiced: </dt>
                    <dd className="inline font-bold text-slate-900 tabular-nums">
                      <MoneyAmount amount={detailBalances.invoiced} />
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-600">Paid: </dt>
                    <dd className="inline font-bold text-slate-900 tabular-nums">
                      <MoneyAmount amount={detailBalances.paid} />
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-600">A/P: </dt>
                    <dd
                      className={`inline font-bold tabular-nums ${
                        detailBalances.apBalance > 0
                          ? 'text-amber-800'
                          : detailBalances.apBalance < 0
                            ? 'text-teal-800'
                            : 'text-slate-900'
                      }`}
                    >
                      <MoneyAmount amount={detailBalances.apBalance} />
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-600">Advance pool: </dt>
                    <dd className="inline font-bold text-slate-900 tabular-nums">
                      <MoneyAmount amount={detailBalances.advancePool} />
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
            {panelMode !== 'payment' ? (
              <button
                type="button"
                onClick={() => setDetailVendorId(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Back to vendors
              </button>
            ) : null}
          </div>
          <div className="px-6 py-6 space-y-10">
            {panelMode === 'payment' && !readOnly ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <h3 className="text-base font-medium text-slate-900">Record payment</h3>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Back to billing
                  </button>
                </div>
                <PaymentRecordPanel
                  layout="page"
                  projectId={projectId}
                  invoices={paymentInvoiceOptions}
                  payments={payments}
                  vendorAdvances={vendorAdvances}
                  vendorName={vendorName}
                  initialPayment={editingPayment}
                  defaultVendorId={detailVendorId ?? undefined}
                  defaultInvoiceId={paymentPrefillInvoiceId ?? undefined}
                  onClose={closePanel}
                  onRefresh={async () => {
                    await onRefresh()
                    if (detailVendorId) {
                      const pay = await api.listPaymentsByVendor(projectId, detailVendorId)
                      setDisplayPayments(pay)
                      const adv = await api.listVendorAdvances(projectId)
                      setVendorAdvances(adv)
                    }
                  }}
                  onError={onError}
                  className="w-full"
                />
              </div>
            ) : (
              <>
              <section>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-medium text-slate-900">Invoices</h3>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVendor(null)
                        setEditingInvoice(null)
                        setEditingPayment(null)
                        setInvoiceCopyTemplate(null)
                        setPanelMode('invoice')
                      }}
                      className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
                    >
                      Record invoice
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="min-w-[7rem] px-2 py-3">Actions</th>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3 text-right">Net</th>
                        <th className="px-4 py-3 text-right">Central GST</th>
                        <th className="px-4 py-3 text-right">State GST</th>
                        <th className="px-4 py-3 text-right">Total</th>
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
                          <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                            No invoices.
                          </td>
                        </tr>
                      ) : (
                        displayInvoices.map((i) => (
                          <tr key={i.id} className={invoiceTableRowClass(i.status)}>
                            <td className="whitespace-nowrap px-2 py-3 align-middle">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title="Edit invoice"
                                  aria-label="Edit invoice"
                                  disabled={actionsDisabled}
                                  className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                                  onClick={() => {
                                    setEditingVendor(null)
                                    setEditingPayment(null)
                                    setInvoiceCopyTemplate(null)
                                    setEditingInvoice(i)
                                    setPanelMode('invoice')
                                  }}
                                >
                                  <PencilIcon />
                                </button>
                                <VendorBillingGlIconButton onClick={() => openInvoiceGlModal(i)} />
                                {i.status !== 'paid' && !readOnly ? (
                                  <button
                                    type="button"
                                    title="Record payment for this invoice"
                                    aria-label="Record payment for this invoice"
                                    className={`${iconBtnClass} text-teal-800 hover:border-teal-200 hover:bg-teal-50`}
                                    onClick={() => {
                                      setEditingVendor(null)
                                      setEditingInvoice(null)
                                      setEditingPayment(null)
                                      setInvoiceCopyTemplate(null)
                                      setPaymentPrefillInvoiceId(i.id)
                                      setPanelMode('payment')
                                    }}
                                  >
                                    <RecordPaymentIcon />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  title="Copy to new invoice"
                                  aria-label="Copy to new invoice"
                                  disabled={actionsDisabled}
                                  className={`${iconBtnClass} text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
                                  onClick={() => {
                                    setEditingVendor(null)
                                    setEditingPayment(null)
                                    setEditingInvoice(null)
                                    setInvoiceCopyTemplate(i)
                                    setPanelMode('invoice')
                                  }}
                                >
                                  <CopyInvoiceIcon />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{i.invoiceNumber}</td>
                            <td className="px-4 py-3 text-right">
                              <MoneyAmount amount={i.amount} currency={i.currency} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <MoneyAmount amount={invoiceCentralGstAmount(i)} currency={i.currency} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <MoneyAmount amount={invoiceStateGstAmount(i)} currency={i.currency} />
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              <MoneyAmount amount={invoiceTotalWithGst(i)} currency={i.currency} />
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(i.issuedDate)}</td>
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
                                      const inv = await api.listInvoicesByVendor(projectId, detailVendorId)
                                      setDisplayInvoices(inv)
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
                  <h3 className="text-base font-medium text-slate-900">Payments</h3>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVendor(null)
                        setEditingInvoice(null)
                        setEditingPayment(null)
                        setInvoiceCopyTemplate(null)
                        setPaymentPrefillInvoiceId(null)
                        setPanelMode('payment')
                      }}
                      className="rounded-lg bg-teal-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-900"
                    >
                      Record payment
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="min-w-[2.75rem] px-2 py-3">Actions</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-4 py-3 text-right">Amount</th>
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
                          <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                            No payments.
                          </td>
                        </tr>
                      ) : (
                        displayPayments.map((p) => {
                          const inv = invoicesById.get(p.invoiceId)
                          return (
                            <tr key={p.id} className="border-b border-slate-100">
                              <td className="whitespace-nowrap px-2 py-3 align-middle">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    title="Edit payment"
                                    aria-label="Edit payment"
                                    disabled={actionsDisabled}
                                    className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                                    onClick={() => {
                                      setEditingVendor(null)
                                      setEditingInvoice(null)
                                      setInvoiceCopyTemplate(null)
                                      setPaymentPrefillInvoiceId(null)
                                      setEditingPayment(p)
                                      setPanelMode('payment')
                                    }}
                                  >
                                    <PencilIcon />
                                  </button>
                                  <VendorBillingGlIconButton
                                    onClick={() => openPaymentGlModal(p, invoicesById.get(p.invoiceId))}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3">{formatDate(p.paidDate)}</td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {inv?.invoiceNumber ?? p.invoiceId}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <MoneyAmount amount={p.amount} currency={inv?.currency ?? 'INR'} />
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {p.paymentMethod ?? p.method ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{p.isPaymentPartial ? 'Yes' : 'No'}</td>
                              <td className="px-4 py-3 text-slate-600">{p.paymentSource ?? '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{p.reference ?? '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{p.comments ?? '—'}</td>
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
                                        const pay = await api.listPaymentsByVendor(projectId, detailVendorId)
                                        setDisplayPayments(pay)
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

              <section>
                <h3 className="text-base font-medium text-slate-900">Vendor advances</h3>
                <div className="mt-3">
                  <VendorDisbursementsAdvancesSection
                    projectId={projectId}
                    vendorId={detailVendorId}
                    vendors={vendors}
                    vendorName={vendorName}
                    onRefresh={onRefresh}
                    onError={onError}
                    readOnly={readOnly}
                  />
                </div>
              </section>
              </>
            )}
          </div>
        </div>
      ) : (
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-slate-900">Vendors</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Use <span className="font-medium">Details</span> to open billing for a vendor (invoices, payments,
                advances) in place of this list. Lump-sum contractor payouts are managed under each invoice.
              </p>
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
                  <th className="min-w-[8rem] px-2 py-3">Actions</th>
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
                    <tr key={v.id} className="border-b border-slate-100">
                      <td className="whitespace-nowrap px-2 py-3 align-middle">
                        <div className="flex items-center gap-1">
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
                          <button
                            type="button"
                            title="Vendor billing details"
                            disabled={actionsDisabled}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            onClick={() => setDetailVendorId(v.id)}
                          >
                            Details
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                      <td className="px-4 py-3 text-slate-600">{vendorKindLabel(v.vendorKind)}</td>
                      <td className="px-4 py-3 text-slate-600">{v.contactName ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{v.email ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-3 align-middle">
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
                                if (detailVendorId === v.id) setDetailVendorId(null)
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
      )}

      <VendorBillingGlModal
        open={glModalOpen}
        title={glModalTitle}
        sections={glModalSections}
        loading={glModalLoading}
        error={glModalError}
        onClose={closeGlModal}
      />

      {panelMode !== null && !(panelMode === 'payment' && detailVendorId != null) && (
        <div className="fixed inset-0 z-[52] bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl">
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
                copyTemplateInvoice={invoiceCopyTemplate}
                defaultVendorId={detailVendorId ?? undefined}
                onClose={closePanel}
                onRefresh={async () => {
                  await onRefresh()
                  if (detailVendorId) {
                    const inv = await api.listInvoicesByVendor(projectId, detailVendorId)
                    setDisplayInvoices(inv)
                  }
                }}
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
                defaultVendorId={detailVendorId ?? undefined}
                defaultInvoiceId={paymentPrefillInvoiceId ?? undefined}
                onClose={closePanel}
                onRefresh={async () => {
                  await onRefresh()
                  if (detailVendorId) {
                    const pay = await api.listPaymentsByVendor(projectId, detailVendorId)
                    setDisplayPayments(pay)
                    const adv = await api.listVendorAdvances(projectId)
                    setVendorAdvances(adv)
                  }
                }}
                onError={onError}
                className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
