import { useEffect, useState } from 'react'

function numOrUndef(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Right-hand sheet for adding or editing a single plot sale payment line.
 */
export function PlotPaymentSheet({
  open,
  onClose,
  title,
  submitLabel,
  saving,
  initialAmount,
  initialMode,
  initialPaidDate,
  initialNotes,
  initialAccountId = '',
  accountChoices,
  onSubmit,
  readOnly = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  submitLabel: string
  saving: boolean
  initialAmount: string
  initialMode: string
  initialPaidDate: string
  initialNotes: string
  /** When `accountChoices` is set, initial selected account id (or empty). */
  initialAccountId?: string
  /** When set, shows “Received into” account dropdown (buyer payments). */
  accountChoices?: { id: string; label: string }[]
  onSubmit: (data: {
    amount?: number | null
    paymentMode: string
    paidDate: string
    notes?: string | null
    accountId?: string | null
  }) => Promise<void>
  readOnly?: boolean
}) {
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [payAccountId, setPayAccountId] = useState('')

  useEffect(() => {
    if (open) {
      setPayAmount(initialAmount)
      setPayMode(initialMode)
      setPayDate(initialPaidDate)
      setPayNotes(initialNotes)
      setPayAccountId(initialAccountId ?? '')
    }
  }, [open, initialAmount, initialMode, initialPaidDate, initialNotes, initialAccountId])

  const labelCls = 'text-xs font-medium text-slate-600'
  const inputCls = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'

  if (!open) return null

  const showAccount = accountChoices != null && accountChoices.length > 0

  return (
    <div
      className="fixed inset-0 z-[55] flex min-h-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plot-payment-sheet-title"
    >
      <button
        type="button"
        className="min-h-0 min-w-0 flex-1 cursor-default bg-slate-900/15"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div className="flex h-screen min-h-0 w-full max-w-md shrink-0 flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-5">
          <h2 id="plot-payment-sheet-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {readOnly ? (
            <p className="text-xs text-amber-800/90">View-only.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelCls}>Amount</span>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Mode</span>
                  <input
                    className={inputCls}
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    placeholder="Cash / UPI / Cheque…"
                  />
                </label>
                {showAccount ? (
                  <label className="block sm:col-span-2">
                    <span className={labelCls}>Received into (account)</span>
                    <select
                      className={inputCls}
                      value={payAccountId}
                      onChange={(e) => setPayAccountId(e.target.value)}
                    >
                      <option value="">— Not specified —</option>
                      {accountChoices.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block sm:col-span-2">
                  <span className={labelCls}>Date</span>
                  <input
                    className={inputCls}
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelCls}>Notes</span>
                  <textarea
                    className={`${inputCls} min-h-[72px]`}
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    rows={2}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void onSubmit({
                    amount: numOrUndef(payAmount) ?? null,
                    paymentMode: payMode.trim() || '—',
                    paidDate: payDate.trim() || new Date().toISOString().slice(0, 10),
                    notes: payNotes.trim() || null,
                    accountId: showAccount ? payAccountId.trim() || null : undefined,
                  })
                }
                className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : submitLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
