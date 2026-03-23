import { useState } from 'react'
import * as api from '../api/dataApi'
import type { Invoice } from '../types'
import { formatMoney } from '../utils/format'

export function PaymentRecordPanel({
  projectId,
  invoices,
  vendorName,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  projectId: string
  invoices: Invoice[]
  vendorName: Map<string, string>
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [paidDate, setPaidDate] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div
      className={[
        'rounded-none border border-slate-200 bg-white p-6 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="text-lg font-medium text-slate-900">Record payment</h2>

      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!invoiceId || !amount || !paidDate) return
          onError(null)
          setSaving(true)
          try {
            await api.createPayment({
              projectId,
              invoiceId,
              amount: Number(amount),
              paidDate,
              reference: reference || undefined,
            })
            await onRefresh()
            onClose()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not add payment.')
          } finally {
            setSaving(false)
          }
        }}
      >
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Invoice</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          >
            <option value="">Select invoice</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.invoiceNumber} — {vendorName.get(i.vendorId) ?? 'Vendor'} —{' '}
                {formatMoney(i.amount, i.currency)} ({i.status})
              </option>
            ))}
          </select>
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
          <span className="text-xs font-medium text-slate-600">Paid on</span>
          <input
            required
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Reference (optional)
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>

        <div className="sm:col-span-2 mt-1 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Add payment'}
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

