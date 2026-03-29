import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/dataApi'
import type { Account, GlAccount, Invoice, Payment, VendorAdvance } from '../types'
import { formatMoney } from '../utils/format'

const paymentMethodOptions = ['Cash', 'Cheque', 'RTGS', 'Other'] as const

type AdvanceLine = { key: string; advanceId: string; amountStr: string }

function newLineKey() {
  return `al-${Math.random().toString(36).slice(2, 10)}`
}

export function PaymentRecordPanel({
  projectId,
  invoices,
  payments,
  vendorAdvances,
  vendorName,
  initialPayment = null,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  projectId: string
  invoices: Invoice[]
  payments: Payment[]
  vendorAdvances: VendorAdvance[]
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
  const [fromAccountAmt, setFromAccountAmt] = useState('')
  const [fromCashAmt, setFromCashAmt] = useState('')
  const [fromOtherAmt, setFromOtherAmt] = useState('')
  const [advanceLines, setAdvanceLines] = useState<AdvanceLine[]>([])
  const [sourceAccountId, setSourceAccountId] = useState('')
  const [glAccountId, setGlAccountId] = useState('')
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([])
  const [bankAccounts, setBankAccounts] = useState<Account[]>([])
  const [saving, setSaving] = useState(false)

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === invoiceId) ?? null,
    [invoices, invoiceId],
  )

  const openBalanceBefore = useMemo(() => {
    if (!selectedInvoice) return null
    const paidOthers = payments
      .filter((p) => p.invoiceId === selectedInvoice.id && (!editing || p.id !== initialPayment?.id))
      .reduce((s, p) => s + p.amount, 0)
    return selectedInvoice.amount - paidOthers
  }, [selectedInvoice, payments, editing, initialPayment])

  const advancesForVendor = useMemo(() => {
    if (!selectedInvoice) return []
    return vendorAdvances.filter((a) => a.vendorId === selectedInvoice.vendorId)
  }, [vendorAdvances, selectedInvoice])

  const fundingParsed = useMemo(() => {
    const fa = parseFloat(fromAccountAmt) || 0
    const fc = parseFloat(fromCashAmt) || 0
    const fo = parseFloat(fromOtherAmt) || 0
    const adv = advanceLines.reduce((s, l) => s + (parseFloat(l.amountStr) || 0), 0)
    return { fa, fc, fo, adv, total: fa + fc + fo + adv }
  }, [fromAccountAmt, fromCashAmt, fromOtherAmt, advanceLines])

  const payAmountNum = parseFloat(amount) || 0
  const fundingOk = Math.abs(fundingParsed.total - payAmountNum) < 0.02

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const [gl, acct] = await Promise.all([api.listGlAccounts(), api.listAccounts()])
        if (!ignore) {
          setGlAccounts(gl.filter((a) => a.isActive !== false))
          setBankAccounts(
            acct.filter(
              (a) =>
                (a.projectId === projectId || a.projectId == null || a.projectId === '') &&
                a.kind === 'bank',
            ),
          )
        }
      } catch {
        if (!ignore) {
          setGlAccounts([])
          setBankAccounts([])
        }
      }
    })()
    return () => {
      ignore = true
    }
  }, [projectId])

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
      setSourceAccountId(initialPayment.sourceAccountId ?? '')
      setGlAccountId(initialPayment.glAccountId ?? '')
      const fa = initialPayment.fromAccountAmount ?? 0
      const fc = initialPayment.fromCashAmount ?? 0
      const fo = initialPayment.fromOtherAmount ?? 0
      const allocs = initialPayment.advanceAllocations ?? []
      if (fa || fc || fo || allocs.length) {
        setFromAccountAmt(fa ? String(fa) : '')
        setFromCashAmt(fc ? String(fc) : '')
        setFromOtherAmt(fo ? String(fo) : '')
        setAdvanceLines(
          allocs.map((a) => ({
            key: newLineKey(),
            advanceId: a.advanceId,
            amountStr: String(a.amount),
          })),
        )
      } else {
        const psk = initialPayment.paymentSourceKind ?? 'other'
        if (psk === 'account') {
          setFromAccountAmt(String(initialPayment.amount))
          setFromCashAmt('')
          setFromOtherAmt('')
        } else if (psk === 'cash') {
          setFromAccountAmt('')
          setFromCashAmt(String(initialPayment.amount))
          setFromOtherAmt('')
        } else {
          setFromAccountAmt('')
          setFromCashAmt('')
          setFromOtherAmt(String(initialPayment.amount))
        }
        setAdvanceLines([])
      }
    } else {
      setInvoiceId('')
      setAmount('')
      setPaidDate('')
      setPaymentMethod('Other')
      setIsPaymentPartial(false)
      setPaymentSource('')
      setReference('')
      setComments('')
      setSourceAccountId('')
      setGlAccountId('')
      setFromAccountAmt('')
      setFromCashAmt('')
      setFromOtherAmt('')
      setAdvanceLines([])
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
      <p className="mt-1 text-xs text-slate-500">
        Total must equal the sum of amounts from vendor advances, bank account, cash, and other. Bank portion
        requires an operating account (funds drawn from that account); GL credits use the standard clearing
        accounts.
      </p>

      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!invoiceId || !amount || !paidDate) return
          if (!fundingOk) {
            onError('Funding breakdown must add up to the payment amount.')
            return
          }
          if (fundingParsed.fa > 0 && !sourceAccountId.trim()) {
            onError('Select the bank account when paying from account.')
            return
          }
          onError(null)
          setSaving(true)
          try {
            const glId = glAccountId.trim() ? glAccountId.trim() : null
            const srcAcct = fundingParsed.fa > 0 ? sourceAccountId.trim() || null : null
            const advanceAllocations = advanceLines
              .filter((l) => l.advanceId && (parseFloat(l.amountStr) || 0) > 0)
              .map((l) => ({ advanceId: l.advanceId, amount: parseFloat(l.amountStr) || 0 }))
            const body = {
              invoiceId,
              amount: Number(amount),
              paidDate,
              paymentMethod,
              isPaymentPartial,
              paymentSource: paymentSource.trim() || null,
              reference: reference.trim() || null,
              comments: comments.trim() || null,
              sourceAccountId: srcAcct,
              glAccountId: glId,
              fromAccountAmount: fundingParsed.fa,
              fromCashAmount: fundingParsed.fc,
              fromOtherAmount: fundingParsed.fo,
              advanceAllocations: advanceAllocations.length ? advanceAllocations : undefined,
            }
            if (editing && initialPayment) {
              await api.updatePayment(initialPayment.id, projectId, body)
            } else {
              await api.createPayment({
                projectId,
                ...body,
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

        {openBalanceBefore != null && selectedInvoice ? (
          <div className="sm:col-span-2 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
            <span className="font-medium">Open on this invoice: </span>
            {formatMoney(openBalanceBefore, selectedInvoice.currency)}
            {payAmountNum > 0 && (
              <span className="ml-2 text-amber-900">
                → After this payment:{' '}
                {formatMoney(openBalanceBefore - payAmountNum, selectedInvoice.currency)}
              </span>
            )}
          </div>
        ) : null}

        {advancesForVendor.length > 0 ? (
          <div className="sm:col-span-2 rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 text-sm text-slate-800">
            <p className="text-xs font-medium uppercase text-teal-900">Vendor advance pool</p>
            <ul className="mt-1 list-inside list-disc text-slate-700">
              {advancesForVendor.map((a) => (
                <li key={a.id}>
                  {formatMoney(a.remainingBalance ?? 0, a.currency)} remaining on advance paid{' '}
                  {a.paidDate.slice(0, 10)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Payment total</span>
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
        {openBalanceBefore != null && selectedInvoice ? (
          <div className="flex items-end">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setAmount(String(Math.max(0, openBalanceBefore)))}
            >
              Set total to open balance
            </button>
          </div>
        ) : (
          <div />
        )}

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

        <div className="sm:col-span-2 border-t border-slate-100 pt-3">
          <h3 className="text-sm font-medium text-slate-900">Funding breakdown</h3>
          <p className="text-xs text-slate-500">These amounts must sum to the payment total.</p>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">From bank account</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={fromAccountAmt}
            onChange={(e) => setFromAccountAmt(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="block sm:col-span-1">
          <span className="text-xs font-medium text-slate-600">Operating account (when bank &gt; 0)</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={sourceAccountId}
            onChange={(e) => setSourceAccountId(e.target.value)}
          >
            <option value="">— Select —</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">From cash</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={fromCashAmt}
            onChange={(e) => setFromCashAmt(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">From other</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={fromOtherAmt}
            onChange={(e) => setFromOtherAmt(e.target.value)}
            placeholder="0"
          />
        </label>

        <div className="sm:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">From vendor advances</span>
            <button
              type="button"
              className="text-xs font-medium text-teal-700 hover:underline"
              onClick={() =>
                setAdvanceLines((rows) => [...rows, { key: newLineKey(), advanceId: '', amountStr: '' }])
              }
            >
              + Add advance line
            </button>
          </div>
          {advanceLines.length === 0 ? (
            <p className="text-xs text-slate-500">No advance applied to this payment.</p>
          ) : (
            <div className="space-y-2">
              {advanceLines.map((line, idx) => (
                <div key={line.key} className="flex flex-wrap items-end gap-2">
                  <select
                    className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    value={line.advanceId}
                    onChange={(e) => {
                      const v = e.target.value
                      setAdvanceLines((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, advanceId: v } : r)),
                      )
                    }}
                  >
                    <option value="">Select advance</option>
                    {advancesForVendor.map((a) => (
                      <option key={a.id} value={a.id}>
                        {formatMoney(a.remainingBalance ?? 0, a.currency)} left — {a.paidDate.slice(0, 10)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Amount"
                    className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    value={line.amountStr}
                    onChange={(e) => {
                      const v = e.target.value
                      setAdvanceLines((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, amountStr: v } : r)),
                      )
                    }}
                  />
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => setAdvanceLines((rows) => rows.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={`sm:col-span-2 rounded-lg px-3 py-2 text-sm ${
            fundingOk ? 'border border-emerald-200 bg-emerald-50 text-emerald-900' : 'border border-red-200 bg-red-50 text-red-900'
          }`}
        >
          Funding sum: {fundingParsed.total.toFixed(2)} · Payment total: {payAmountNum.toFixed(2)}
          {!fundingOk ? ' — must match' : ' — OK'}
        </div>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Source note (optional)</span>
          <input
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={paymentSource}
            onChange={(e) => setPaymentSource(e.target.value)}
            placeholder="e.g. UPI ref, cheque #"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">GL cash / bank account (optional)</span>
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
              Partial payment (invoice may still show balance due)
            </label>
          </div>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Reference (optional)</span>
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
            disabled={saving || !fundingOk}
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
