import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/dataApi'
import type { GlAccount, Invoice, InvoiceStatus, Vendor, VendorDisbursementBatch } from '../types'
import { formatDate, formatMoney } from '../utils/format'

const statusOptions: InvoiceStatus[] = ['draft', 'sent', 'paid', 'partial', 'overdue']

export function InvoiceRecordPanel({
  projectId,
  vendors,
  initialInvoice = null,
  defaultVendorId,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  projectId: string
  vendors: Vendor[]
  initialInvoice?: Invoice | null
  /** Pre-select vendor when creating an invoice from a vendor’s detail view. */
  defaultVendorId?: string
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const editing = initialInvoice != null
  const [vendorId, setVendorId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [amount, setAmount] = useState('')
  const [issuedDate, setIssuedDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<InvoiceStatus>('sent')
  const [glAccountId, setGlAccountId] = useState('')
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([])
  const [saving, setSaving] = useState(false)
  const [linkedBatches, setLinkedBatches] = useState<VendorDisbursementBatch[]>([])
  const [linkableBatches, setLinkableBatches] = useState<VendorDisbursementBatch[]>([])
  const [linkPickId, setLinkPickId] = useState('')
  const [disbLoading, setDisbLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const list = await api.listGlAccounts()
        if (!ignore) setGlAccounts(list.filter((a) => a.isActive !== false))
      } catch {
        if (!ignore) setGlAccounts([])
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (initialInvoice) {
      setVendorId(initialInvoice.vendorId)
      setInvoiceNo(initialInvoice.invoiceNumber)
      setAmount(String(initialInvoice.amount))
      setIssuedDate(initialInvoice.issuedDate.slice(0, 10))
      setDueDate(initialInvoice.dueDate?.slice(0, 10) ?? '')
      setStatus(initialInvoice.status)
      setGlAccountId(initialInvoice.glAccountId ?? '')
    } else {
      setVendorId(defaultVendorId ?? '')
      setInvoiceNo('')
      setAmount('')
      setIssuedDate('')
      setDueDate('')
      setStatus('sent')
      setGlAccountId('')
    }
  }, [initialInvoice, defaultVendorId])

  const reloadDisbursements = useCallback(async () => {
    if (!initialInvoice) {
      setLinkedBatches([])
      setLinkableBatches([])
      return
    }
    setDisbLoading(true)
    onError(null)
    try {
      const [linked, forVendor] = await Promise.all([
        api.listVendorDisbursementBatches(projectId, { invoiceId: initialInvoice.id }),
        api.listVendorDisbursementBatches(projectId, { vendorId: initialInvoice.vendorId }),
      ])
      setLinkedBatches(linked)
      setLinkableBatches(forVendor.filter((b) => !b.invoiceId || b.invoiceId === initialInvoice.id))
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not load disbursement batches.')
    } finally {
      setDisbLoading(false)
    }
  }, [projectId, initialInvoice, onError])

  useEffect(() => {
    void reloadDisbursements()
  }, [reloadDisbursements])

  return (
    <div
      className={[
        'rounded-none border border-slate-200 bg-white p-6 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="text-lg font-medium text-slate-900">
        {editing ? 'Edit invoice' : 'Record invoice'}
      </h2>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!vendorId || !invoiceNo.trim() || !amount || !issuedDate) return
          onError(null)
          setSaving(true)
          try {
            const glId = glAccountId.trim() ? glAccountId.trim() : undefined
            if (editing && initialInvoice) {
              await api.updateInvoice(
                initialInvoice.id,
                {
                  vendorId,
                  invoiceNumber: invoiceNo.trim(),
                  amount: Number(amount),
                  issuedDate,
                  dueDate: dueDate.trim() ? dueDate : null,
                  status,
                  glAccountId: glId ?? null,
                },
                projectId,
              )
            } else {
              await api.createInvoice({
                projectId,
                vendorId,
                invoiceNumber: invoiceNo,
                amount: Number(amount),
                issuedDate,
                dueDate: dueDate || undefined,
                glAccountId: glId,
              })
            }
            await onRefresh()
            onClose()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not save invoice.')
          } finally {
            setSaving(false)
          }
        }}
      >
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Vendor</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Invoice #</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Amount</span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Issued</span>
          <input
            required
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={issuedDate}
            onChange={(e) => setIssuedDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Due (optional)</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
        {editing ? (
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">GL expense account (optional)</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={glAccountId}
            onChange={(e) => setGlAccountId(e.target.value)}
          >
            <option value="">— None —</option>
            {glAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2 mt-1 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add invoice'}
          </button>
          <button
            type="button"
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>

      {editing && initialInvoice ? (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h3 className="text-base font-medium text-slate-900">Contractor disbursements &amp; subcontractor charges</h3>
          <p className="mt-1 text-sm text-slate-600">
            Lump-sum payouts to a contractor with optional line-level breakdown (subcontractor invoices/charges).
            Link an existing batch to this invoice, or create one via the API with{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">invoiceId</code>.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-600">
              Link batch (same vendor, not linked elsewhere)
              <select
                className="mt-1 block min-w-[14rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={linkPickId}
                onChange={(e) => setLinkPickId(e.target.value)}
              >
                <option value="">— Select —</option>
                {linkableBatches
                  .filter((b) => !b.invoiceId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {formatDate(b.paidToContractorDate)} · {formatMoney(b.lumpSumAmount, b.currency)}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!linkPickId || disbLoading}
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              onClick={() => {
                if (!linkPickId || !initialInvoice) return
                void (async () => {
                  try {
                    onError(null)
                    await api.updateVendorDisbursementBatch(projectId, linkPickId, {
                      invoiceId: initialInvoice.id,
                    })
                    setLinkPickId('')
                    await reloadDisbursements()
                    await onRefresh()
                  } catch (err) {
                    onError(err instanceof Error ? err.message : 'Could not link batch.')
                  }
                })()
              }}
            >
              Link to invoice
            </button>
          </div>

          {disbLoading ? <p className="mt-3 text-sm text-slate-600">Loading batches…</p> : null}

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Paid to contractor</th>
                  <th className="px-4 py-3">Lump sum</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Subcontractor lines</th>
                  <th className="px-4 py-3"> </th>
                </tr>
              </thead>
              <tbody>
                {linkedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No disbursement batches linked to this invoice yet.
                    </td>
                  </tr>
                ) : (
                  linkedBatches.map((b) => (
                    <tr key={b.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-2">{formatDate(b.paidToContractorDate)}</td>
                      <td className="px-4 py-2">{formatMoney(b.lumpSumAmount, b.currency)}</td>
                      <td className="px-4 py-2 capitalize">{b.paymentSourceKind}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {(b.lines?.length ?? 0) === 0 ? (
                          '—'
                        ) : (
                          <ul className="list-inside list-disc text-xs">
                            {b.lines!.map((ln) => (
                              <li key={ln.id}>
                                <span className="font-medium">{ln.partyName}</span>
                                {ln.invoiceNumber ? (
                                  <span className="text-slate-500"> · #{ln.invoiceNumber}</span>
                                ) : null}
                                {' — '}
                                {formatMoney(ln.paidAmount, b.currency)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-slate-600 hover:text-slate-900"
                          onClick={() => {
                            void (async () => {
                              try {
                                onError(null)
                                await api.updateVendorDisbursementBatch(projectId, b.id, { invoiceId: null })
                                await reloadDisbursements()
                                await onRefresh()
                              } catch (err) {
                                onError(err instanceof Error ? err.message : 'Could not unlink batch.')
                              }
                            })()
                          }}
                        >
                          Unlink
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
