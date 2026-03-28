import { useEffect, useState } from 'react'
import * as api from '../api/dataApi'
import type { Invoice, InvoiceStatus, Vendor } from '../types'

const statusOptions: InvoiceStatus[] = ['draft', 'sent', 'paid', 'partial', 'overdue']

export function InvoiceRecordPanel({
  projectId,
  vendors,
  initialInvoice = null,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  projectId: string
  vendors: Vendor[]
  initialInvoice?: Invoice | null
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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialInvoice) {
      setVendorId(initialInvoice.vendorId)
      setInvoiceNo(initialInvoice.invoiceNumber)
      setAmount(String(initialInvoice.amount))
      setIssuedDate(initialInvoice.issuedDate.slice(0, 10))
      setDueDate(initialInvoice.dueDate?.slice(0, 10) ?? '')
      setStatus(initialInvoice.status)
    } else {
      setVendorId('')
      setInvoiceNo('')
      setAmount('')
      setIssuedDate('')
      setDueDate('')
      setStatus('sent')
    }
  }, [initialInvoice])

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
    </div>
  )
}
