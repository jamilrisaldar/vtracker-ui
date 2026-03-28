import { useEffect, useState } from 'react'
import * as api from '../api/dataApi'
import type { Invoice, Payment } from '../types'
import { formatMoney } from '../utils/format'

const paymentMethodOptions = ['Cash', 'Cheque', 'RTGS', 'Other'] as const

export function PaymentRecordPanel({
  projectId,
  invoices,
  vendorName,
  initialPayment = null,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  projectId: string
  invoices: Invoice[]
  vendorName: Map<string, string>
  initialPayment?: Payment | null
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const editing = initialPayment != null
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [paidDate, setPaidDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethodOptions)[number]>('Other')
  const [isPaymentPartial, setIsPaymentPartial] = useState(false)
  const [paymentSource, setPaymentSource] = useState('')
  const [reference, setReference] = useState('')
  const [comments, setComments] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialPayment) {
      setInvoiceId(initialPayment.invoiceId)
      setAmount(String(initialPayment.amount))
      setPaidDate(initialPayment.paidDate.slice(0, 10))
      setPaymentMethod(
        (initialPayment.paymentMethod as (typeof paymentMethodOptions)[number] | undefined) ?? 'Other',
      )
      setIsPaymentPartial(initialPayment.isPaymentPartial === true)
      setPaymentSource(initialPayment.paymentSource ?? '')
      setReference(initialPayment.reference ?? '')
      setComments(initialPayment.comments ?? '')
    } else {
      setInvoiceId('')
      setAmount('')
      setPaidDate('')
      setPaymentMethod('Other')
      setIsPaymentPartial(false)
      setPaymentSource('')
      setReference('')
      setComments('')
    }
  }, [initialPayment])

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
        {editing ? 'Edit payment' : 'Record payment'}
      </h2>

      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!invoiceId || !amount || !paidDate) return
          onError(null)
          setSaving(true)
          try {
            if (editing && initialPayment) {
              await api.updatePayment(initialPayment.id, projectId, {
                invoiceId,
                amount: Number(amount),
                paidDate,
                paymentMethod,
                isPaymentPartial,
                paymentSource: paymentSource.trim() || null,
                reference: reference.trim() || null,
                comments: comments.trim() || null,
              })
            } else {
              await api.createPayment({
                projectId,
                invoiceId,
                amount: Number(amount),
                paidDate,
                paymentMethod,
                isPaymentPartial,
                paymentSource: paymentSource || undefined,
                reference: reference || undefined,
                comments: comments || undefined,
              })
            }
            await onRefresh()
            onClose()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not save payment.')
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
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Payment method</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as (typeof paymentMethodOptions)[number])}
          >
            {paymentMethodOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Payment source (optional)</span>
          <input
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={paymentSource}
            onChange={(e) => setPaymentSource(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Payment details</span>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <input
              id="isPaymentPartial"
              type="checkbox"
              className="h-4 w-4"
              checked={isPaymentPartial}
              onChange={(e) => setIsPaymentPartial(e.target.checked)}
            />
            <label htmlFor="isPaymentPartial" className="text-slate-700">
              Partial payment
            </label>
          </div>
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
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Comments (optional)</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </label>

        <div className="sm:col-span-2 mt-1 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add payment'}
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
