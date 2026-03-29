import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/dataApi'
import type { Account, GlAccount, Invoice, Payment, VendorAdvance } from '../types'
import { isBackendAuthEnabled } from '../config'
import { formatMoney } from '../utils/format'
import { invoiceGstAmount, invoiceTotalWithGst } from '../utils/invoiceTotals'

const paymentMethodOptions = ['Cash', 'Cheque', 'RTGS', 'Other'] as const

type AdvanceLine = { key: string; advanceId: string; amountStr: string }

type DisburseLine = {
  key: string
  partyName: string
  paidAmountStr: string
  invoiceNumber: string
  datePaid: string
  notes: string
  glAccountId: string
}

function newLineKey() {
  return `al-${Math.random().toString(36).slice(2, 10)}`
}

function newDisburseKey() {
  return `dl-${Math.random().toString(36).slice(2, 10)}`
}

/** Single funding source for disbursement batch metadata when payment GL already posted. */
function disbursementSourceKind(
  fa: number,
  fc: number,
  fo: number,
  adv: number,
): 'account' | 'cash' | 'other' {
  const n = (fa > 0 ? 1 : 0) + (fc > 0 ? 1 : 0) + (fo > 0 ? 1 : 0) + (adv > 0 ? 1 : 0)
  if (n !== 1) return 'other'
  if (fa > 0) return 'account'
  if (fc > 0) return 'cash'
  return 'other'
}

export function PaymentRecordPanel({
  projectId,
  invoices,
  payments,
  vendorAdvances,
  vendorName,
  initialPayment = null,
  defaultVendorId,
  onClose,
  onRefresh,
  onError,
  className,
  layout = 'drawer',
}: {
  projectId: string
  invoices: Invoice[]
  payments: Payment[]
  vendorAdvances: VendorAdvance[]
  vendorName: Map<string, string>
  initialPayment?: Payment | null
  /** When recording a new payment from a vendor’s detail view, prefer that vendor’s invoices. */
  defaultVendorId?: string
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
  /** `page` = full-width layout for vendor billing (less cramped than the right drawer). */
  layout?: 'drawer' | 'page'
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
  const [includeDisbursement, setIncludeDisbursement] = useState(false)
  const [disburseLines, setDisburseLines] = useState<DisburseLine[]>([])

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === invoiceId) ?? null,
    [invoices, invoiceId],
  )

  const openBalanceBefore = useMemo(() => {
    if (!selectedInvoice) return null
    const paidOthers = payments
      .filter((p) => p.invoiceId === selectedInvoice.id && (!editing || p.id !== initialPayment?.id))
      .reduce((s, p) => s + p.amount, 0)
    return invoiceTotalWithGst(selectedInvoice) - paidOthers
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

  const filledDisburseLines = useMemo(
    () =>
      disburseLines.filter(
        (l) => l.partyName.trim() !== '' && (parseFloat(l.paidAmountStr) || 0) > 0,
      ),
    [disburseLines],
  )
  const disburseSum = useMemo(
    () => filledDisburseLines.reduce((s, l) => s + (parseFloat(l.paidAmountStr) || 0), 0),
    [filledDisburseLines],
  )
  /** If breakdown is on, require at least one line and totals must match payment. */
  const disburseSectionOk =
    !includeDisbursement ||
    (filledDisburseLines.length > 0 && Math.abs(disburseSum - payAmountNum) < 0.02)

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
      setIncludeDisbursement(false)
      setDisburseLines([])
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
      setIncludeDisbursement(false)
      setDisburseLines([])
    }
  }, [initialPayment])

  useEffect(() => {
    if (initialPayment || !defaultVendorId) return
    const inv = invoices.find((i) => i.vendorId === defaultVendorId)
    if (inv) {
      setInvoiceId((cur) => (cur === '' ? inv.id : cur))
    }
  }, [initialPayment, defaultVendorId, invoices])

  const pageLayout = layout === 'page'

  return (
    <div
      className={[
        pageLayout
          ? 'w-full max-w-4xl border-0 bg-white p-4 shadow-none sm:p-6'
          : 'rounded-none border border-slate-200 bg-white p-6 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="text-lg font-medium text-slate-900">
        {editing ? 'Edit payment' : 'Record payment'}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Total must equal the sum of advances, bank, cash, and other. Bank portion requires an operating account.
        {pageLayout
          ? ' Optional: record how this payment breaks down to subcontractors (stored with the invoice; no extra GL).'
          : ''}
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
          if (!editing && includeDisbursement) {
            if (filledDisburseLines.length === 0) {
              onError('Add at least one subcontractor line with name and amount, or turn off subcontractor breakdown.')
              return
            }
            if (Math.abs(disburseSum - payAmountNum) > 0.02) {
              onError(
                `Subcontractor paid amounts (${disburseSum.toFixed(2)}) must equal the payment total (${payAmountNum.toFixed(2)}).`,
              )
              return
            }
            const expGl = glAccountId.trim() || selectedInvoice?.glAccountId
            if (!expGl) {
              onError(
                'Select a GL expense account on this form, or set one on the invoice, to save subcontractor lines.',
              )
              return
            }
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

            if (
              !editing &&
              includeDisbursement &&
              filledDisburseLines.length > 0 &&
              isBackendAuthEnabled() &&
              selectedInvoice
            ) {
              const expGl = glAccountId.trim() || selectedInvoice.glAccountId
              const advSum = advanceAllocations.reduce((s, a) => s + a.amount, 0)
              try {
                await api.createVendorDisbursementBatch(projectId, {
                  vendorId: selectedInvoice.vendorId,
                  invoiceId: selectedInvoice.id,
                  lumpSumAmount: payAmountNum,
                  currency: selectedInvoice.currency,
                  paidToContractorDate: paidDate,
                  paymentSourceKind: disbursementSourceKind(
                    fundingParsed.fa,
                    fundingParsed.fc,
                    fundingParsed.fo,
                    advSum,
                  ),
                  sourceAccountId: srcAcct,
                  reference: reference.trim() || null,
                  notes:
                    comments.trim() || 'Subcontractor breakdown with invoice payment (GL on payment only).',
                  glAccountId: expGl!,
                  postToGeneralLedger: false,
                  lines: filledDisburseLines.map((l) => ({
                    partyName: l.partyName.trim(),
                    paidAmount: parseFloat(l.paidAmountStr) || 0,
                    invoiceNumber: l.invoiceNumber.trim() || null,
                    datePaid: l.datePaid.trim() ? l.datePaid : null,
                    notes: l.notes.trim() || null,
                    glAccountId: l.glAccountId.trim() || null,
                  })),
                })
              } catch (batchErr) {
                onError(
                  `Payment was saved, but subcontractor breakdown failed: ${
                    batchErr instanceof Error ? batchErr.message : 'Unknown error'
                  }. Add breakdown from the invoice screen or adjust and retry.`,
                )
                await onRefresh()
                onClose()
                return
              }
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
                {formatMoney(i.amount, i.currency)} + GST {formatMoney(invoiceGstAmount(i), i.currency)} ={' '}
                {formatMoney(invoiceTotalWithGst(i), i.currency)} ({i.status})
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

        {!editing ? (
          <div className="sm:col-span-2 space-y-3 border-t border-slate-200 pt-6">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={includeDisbursement}
                onChange={(e) => {
                  setIncludeDisbursement(e.target.checked)
                  if (e.target.checked && disburseLines.length === 0) {
                    setDisburseLines([
                      {
                        key: newDisburseKey(),
                        partyName: '',
                        paidAmountStr: '',
                        invoiceNumber: '',
                        datePaid: paidDate || '',
                        notes: '',
                        glAccountId: '',
                      },
                    ])
                  }
                }}
              />
              <span>
                <span className="text-sm font-medium text-slate-900">Subcontractor / disbursement lines</span>
                <span className="mt-1 block text-xs text-slate-600">
                  Optional. Record who was paid under this invoice payment. Line amounts must sum to the payment
                  total. Uses the same GL as the payment (no duplicate posting). Backend API only.
                </span>
              </span>
            </label>
            {includeDisbursement ? (
              <div className="space-y-4 rounded-xl border border-teal-100 bg-teal-50/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">Subcontractors</span>
                  <button
                    type="button"
                    className="text-sm font-medium text-teal-800 hover:underline"
                    onClick={() =>
                      setDisburseLines((rows) => [
                        ...rows,
                        {
                          key: newDisburseKey(),
                          partyName: '',
                          paidAmountStr: '',
                          invoiceNumber: '',
                          datePaid: paidDate || '',
                          notes: '',
                          glAccountId: '',
                        },
                      ])
                    }
                  >
                    + Add line
                  </button>
                </div>
                {disburseLines.map((line, idx) => (
                  <div
                    key={line.key}
                    className="grid gap-3 border-b border-teal-100/80 pb-4 last:border-0 last:pb-0 sm:grid-cols-2"
                  >
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-medium text-slate-600">Subcontractor / party name</span>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={line.partyName}
                        placeholder="e.g. ABC Electricals"
                        onChange={(e) => {
                          const v = e.target.value
                          setDisburseLines((rows) => rows.map((r, i) => (i === idx ? { ...r, partyName: v } : r)))
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Paid amount</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={line.paidAmountStr}
                        onChange={(e) => {
                          const v = e.target.value
                          setDisburseLines((rows) => rows.map((r, i) => (i === idx ? { ...r, paidAmountStr: v } : r)))
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Their invoice # (optional)</span>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={line.invoiceNumber}
                        onChange={(e) => {
                          const v = e.target.value
                          setDisburseLines((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, invoiceNumber: v } : r)),
                          )
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">Date paid (optional)</span>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={line.datePaid}
                        onChange={(e) => {
                          const v = e.target.value
                          setDisburseLines((rows) => rows.map((r, i) => (i === idx ? { ...r, datePaid: v } : r)))
                        }}
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-medium text-slate-600">Line GL (optional)</span>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={line.glAccountId}
                        onChange={(e) => {
                          const v = e.target.value
                          setDisburseLines((rows) => rows.map((r, i) => (i === idx ? { ...r, glAccountId: v } : r)))
                        }}
                      >
                        <option value="">— Same as batch / invoice —</option>
                        {glAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-medium text-slate-600">Notes (optional)</span>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={line.notes}
                        onChange={(e) => {
                          const v = e.target.value
                          setDisburseLines((rows) => rows.map((r, i) => (i === idx ? { ...r, notes: v } : r)))
                        }}
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-red-600 hover:underline"
                        onClick={() => setDisburseLines((rows) => rows.filter((_, i) => i !== idx))}
                      >
                        Remove line
                      </button>
                    </div>
                  </div>
                ))}
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    includeDisbursement && filledDisburseLines.length > 0 && Math.abs(disburseSum - payAmountNum) < 0.02
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border border-amber-200 bg-amber-50 text-amber-950'
                  }`}
                >
                  {filledDisburseLines.length === 0
                    ? 'Add at least one line with a name and amount, or turn off subcontractor breakdown.'
                    : `Subcontractor lines total: ${disburseSum.toFixed(2)} · Payment: ${payAmountNum.toFixed(2)}${
                        Math.abs(disburseSum - payAmountNum) < 0.02 ? ' — OK' : ' — must match'
                      }`}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="sm:col-span-2 mt-1 flex gap-2">
          <button
            type="submit"
            disabled={saving || !fundingOk || !disburseSectionOk}
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
