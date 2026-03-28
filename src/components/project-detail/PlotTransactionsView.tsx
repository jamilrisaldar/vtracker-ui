import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Account, LandPlot, PlotSale, PlotSaleAgentPayment, PlotSalePayment } from '../../types'
import { MoneyInrShorthand } from '../MoneyInrShorthand'
import { CopyIcon, PencilIcon, TrashIcon, iconBtnClass } from '../accounts/ledgerIcons'
import { PlotPaymentSheet } from './PlotPaymentSheet'
import { PlotSaleDetailsSheet } from './PlotSaleDetailsSheet'

/** Row tint + left accent by payment mode (buyer lines table). */
function buyerPaymentRowClass(mode: string | undefined): string {
  const m = (mode?.trim().toLowerCase() ?? '').replace(/\s+/g, ' ')
  const base = 'border-t border-slate-100 transition-colors'
  if (!m) {
    return `${base} border-l-[3px] border-l-slate-300 bg-slate-50/50`
  }
  const rules: [RegExp, string][] = [
    [/\brtgs\b/, 'border-l-sky-500 bg-sky-50/90'],
    [/\bneft\b/, 'border-l-blue-500 bg-blue-50/90'],
    [/\bimps\b/, 'border-l-indigo-500 bg-indigo-50/90'],
    [/\bupi\b/, 'border-l-violet-500 bg-violet-50/90'],
    [/\b(cheque|check|chq)\b/, 'border-l-amber-500 bg-amber-50/90'],
    [/\b(dd|demand\s*draft)\b/, 'border-l-orange-500 bg-orange-50/90'],
    [/\bcash\b/, 'border-l-emerald-500 bg-emerald-50/90'],
    [/\b(card|pos|debit|credit)\b/, 'border-l-teal-500 bg-teal-50/90'],
    [/\b(online|net\s*banking|internet\s*banking)\b/, 'border-l-cyan-500 bg-cyan-50/90'],
    [/\b(wire|bank\s*transfer)\b/, 'border-l-sky-600 bg-sky-50/80'],
  ]
  for (const [re, tone] of rules) {
    if (re.test(m)) return `${base} border-l-[3px] ${tone}`
  }
  const fallback = [
    'border-l-fuchsia-500 bg-fuchsia-50/85',
    'border-l-rose-500 bg-rose-50/85',
    'border-l-lime-600 bg-lime-50/85',
    'border-l-pink-500 bg-pink-50/85',
  ]
  let h = 0
  for (let i = 0; i < m.length; i++) h = (h * 31 + m.charCodeAt(i)) >>> 0
  return `${base} border-l-[3px] ${fallback[h % fallback.length]}`
}

export function PlotTransactionsView({
  projectId,
  plot,
  projectPlots,
  onBack,
  onError,
  onProjectRefresh,
  onEditCombinedSale,
  readOnly = false,
  showBackButton = true,
}: {
  projectId: string
  plot: LandPlot
  projectPlots: LandPlot[]
  onBack: () => void
  onError: (msg: string | null) => void
  onProjectRefresh?: () => Promise<void>
  onEditCombinedSale?: (groupId: string) => void
  readOnly?: boolean
  /** When false, parent renders the back control (e.g. PlotsTab top bar). */
  showBackButton?: boolean
}) {
  const [sale, setSale] = useState<PlotSale | null>(null)
  const [payments, setPayments] = useState<PlotSalePayment[]>([])
  const [agentPayments, setAgentPayments] = useState<PlotSaleAgentPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [saleSheetOpen, setSaleSheetOpen] = useState(false)

  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)
  const [paymentSheetMode, setPaymentSheetMode] = useState<'add' | 'edit'>('add')
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [sheetInitialAmount, setSheetInitialAmount] = useState('')
  const [sheetInitialMode, setSheetInitialMode] = useState('')
  const [sheetInitialDate, setSheetInitialDate] = useState('')
  const [sheetInitialNotes, setSheetInitialNotes] = useState('')
  const [sheetInitialAccountId, setSheetInitialAccountId] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentSheetFromDuplicate, setPaymentSheetFromDuplicate] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])

  const [agentSheetOpen, setAgentSheetOpen] = useState(false)
  const [agentSheetMode, setAgentSheetMode] = useState<'add' | 'edit'>('add')
  const [editingAgentPaymentId, setEditingAgentPaymentId] = useState<string | null>(null)
  const [agentSheetInitialAmount, setAgentSheetInitialAmount] = useState('')
  const [agentSheetInitialMode, setAgentSheetInitialMode] = useState('')
  const [agentSheetInitialDate, setAgentSheetInitialDate] = useState('')
  const [agentSheetInitialNotes, setAgentSheetInitialNotes] = useState('')
  const [savingAgentPayment, setSavingAgentPayment] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const [s, p, ap] = await Promise.all([
        api.getPlotSale(plot.id, projectId),
        api.listPlotSalePayments(plot.id, projectId),
        api.listPlotSaleAgentPayments(plot.id, projectId),
      ])
      setSale(s)
      setPayments(p)
      setAgentPayments(ap)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [plot.id, projectId, onError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    void api
      .listAccounts()
      .then((rows) => {
        if (!cancelled) setAccounts(rows)
      })
      .catch(() => {
        if (!cancelled) setAccounts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (sale?.paymentsLocked === true && paymentSheetOpen) {
      setPaymentSheetOpen(false)
      setEditingPaymentId(null)
      setPaymentSheetFromDuplicate(false)
    }
  }, [sale?.paymentsLocked, paymentSheetOpen])

  useEffect(() => {
    if (sale?.paymentsLocked === true && agentSheetOpen) {
      setAgentSheetOpen(false)
      setEditingAgentPaymentId(null)
    }
  }, [sale?.paymentsLocked, agentSheetOpen])

  const currency = sale?.currency || plot.currency || 'INR'
  const paymentsLocked = sale?.paymentsLocked === true
  const paymentsReadOnly = readOnly || paymentsLocked

  const plotNumberDisplay = plot.plotNumber?.trim() ? plot.plotNumber.trim() : plot.id.slice(0, 8)

  const buyerPaymentAgg = useMemo(() => {
    const byMode = new Map<string, number>()
    let total = 0
    let linesWithoutAmount = 0
    for (const p of payments) {
      const mode = (p.paymentMode ?? '').trim() || '—'
      const a = p.amount
      if (a != null && Number.isFinite(a)) {
        total += a
        byMode.set(mode, (byMode.get(mode) ?? 0) + a)
      } else {
        linesWithoutAmount += 1
      }
    }
    const byModeSorted = [...byMode.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    return { byModeSorted, total, linesWithoutAmount }
  }, [payments])

  const negotiated = sale?.negotiatedFinalPrice
  const hasNegotiated = negotiated != null && Number.isFinite(negotiated)
  const outstanding = hasNegotiated ? negotiated - buyerPaymentAgg.total : null

  const buyerAccountChoices = useMemo(
    () =>
      accounts.map((a) => ({
        id: a.id,
        label: `${a.name} (${a.kind}) · ${a.currency}`,
      })),
    [accounts],
  )

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  const openAddPayment = () => {
    onError(null)
    setPaymentSheetFromDuplicate(false)
    setPaymentSheetMode('add')
    setEditingPaymentId(null)
    setSheetInitialAmount('')
    setSheetInitialMode('')
    setSheetInitialDate('')
    setSheetInitialNotes('')
    setSheetInitialAccountId('')
    setPaymentSheetOpen(true)
  }

  const openCopyPayment = (p: PlotSalePayment) => {
    if (paymentsReadOnly) return
    onError(null)
    setPaymentSheetFromDuplicate(true)
    setPaymentSheetMode('add')
    setEditingPaymentId(null)
    setSheetInitialAmount(p.amount != null ? String(p.amount) : '')
    setSheetInitialMode(p.paymentMode ?? '')
    setSheetInitialDate(p.paidDate?.trim().slice(0, 10) ?? '')
    setSheetInitialNotes(p.notes ?? '')
    setSheetInitialAccountId(p.accountId ?? '')
    setPaymentSheetOpen(true)
  }

  const openEditPayment = (p: PlotSalePayment) => {
    onError(null)
    setPaymentSheetFromDuplicate(false)
    setPaymentSheetMode('edit')
    setEditingPaymentId(p.id)
    setSheetInitialAmount(p.amount != null ? String(p.amount) : '')
    setSheetInitialMode(p.paymentMode ?? '')
    setSheetInitialDate(p.paidDate ?? '')
    setSheetInitialNotes(p.notes ?? '')
    setSheetInitialAccountId(p.accountId ?? '')
    setPaymentSheetOpen(true)
  }

  const closePaymentSheet = () => {
    setPaymentSheetOpen(false)
    setEditingPaymentId(null)
    setPaymentSheetFromDuplicate(false)
  }

  const submitPaymentSheet = async (data: {
    amount?: number | null
    paymentMode: string
    paidDate: string
    notes?: string | null
    accountId?: string | null
  }) => {
    setSavingPayment(true)
    onError(null)
    try {
      if (paymentSheetMode === 'add') {
        const row = await api.createPlotSalePayment(plot.id, projectId, {
          paymentMode: data.paymentMode,
          paidDate: data.paidDate,
          amount: data.amount,
          notes: data.notes,
          accountId: data.accountId ?? null,
        })
        setPayments((prev) => [row, ...prev])
      } else if (editingPaymentId) {
        const row = await api.updatePlotSalePayment(plot.id, editingPaymentId, projectId, {
          amount: data.amount ?? null,
          paymentMode: data.paymentMode,
          paidDate: data.paidDate,
          notes: data.notes ?? null,
          accountId: data.accountId ?? null,
        })
        setPayments((prev) => prev.map((x) => (x.id === row.id ? row : x)))
      }
      await onProjectRefresh?.()
      closePaymentSheet()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save payment')
    } finally {
      setSavingPayment(false)
    }
  }

  const deletePayment = async (id: string) => {
    if (!window.confirm('Delete this payment line?')) return
    onError(null)
    try {
      await api.deletePlotSalePayment(plot.id, id, projectId)
      setPayments((prev) => prev.filter((x) => x.id !== id))
      if (editingPaymentId === id) closePaymentSheet()
      await onProjectRefresh?.()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete payment')
    }
  }

  const openAddAgentPayment = () => {
    onError(null)
    setAgentSheetMode('add')
    setEditingAgentPaymentId(null)
    setAgentSheetInitialAmount('')
    setAgentSheetInitialMode('')
    setAgentSheetInitialDate('')
    setAgentSheetInitialNotes('')
    setAgentSheetOpen(true)
  }

  const openEditAgentPayment = (p: PlotSaleAgentPayment) => {
    onError(null)
    setAgentSheetMode('edit')
    setEditingAgentPaymentId(p.id)
    setAgentSheetInitialAmount(p.amount != null ? String(p.amount) : '')
    setAgentSheetInitialMode(p.paymentMode ?? '')
    setAgentSheetInitialDate(p.paidDate ?? '')
    setAgentSheetInitialNotes(p.notes ?? '')
    setAgentSheetOpen(true)
  }

  const closeAgentPaymentSheet = () => {
    setAgentSheetOpen(false)
    setEditingAgentPaymentId(null)
  }

  const submitAgentPaymentSheet = async (data: {
    amount?: number | null
    paymentMode: string
    paidDate: string
    notes?: string | null
    accountId?: string | null
  }) => {
    setSavingAgentPayment(true)
    onError(null)
    try {
      if (agentSheetMode === 'add') {
        const row = await api.createPlotSaleAgentPayment(plot.id, projectId, {
          paymentMode: data.paymentMode,
          paidDate: data.paidDate,
          amount: data.amount,
          notes: data.notes,
        })
        setAgentPayments((prev) => [row, ...prev])
      } else if (editingAgentPaymentId) {
        const row = await api.updatePlotSaleAgentPayment(
          plot.id,
          editingAgentPaymentId,
          projectId,
          {
            amount: data.amount ?? null,
            paymentMode: data.paymentMode,
            paidDate: data.paidDate,
            notes: data.notes ?? null,
          },
        )
        setAgentPayments((prev) => prev.map((x) => (x.id === row.id ? row : x)))
      }
      await onProjectRefresh?.()
      closeAgentPaymentSheet()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save agent payment')
    } finally {
      setSavingAgentPayment(false)
    }
  }

  const deleteAgentPayment = async (id: string) => {
    if (!window.confirm('Delete this agent payment line?')) return
    onError(null)
    try {
      await api.deletePlotSaleAgentPayment(plot.id, id, projectId)
      setAgentPayments((prev) => prev.filter((x) => x.id !== id))
      if (editingAgentPaymentId === id) closeAgentPaymentSheet()
      await onProjectRefresh?.()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete agent payment')
    }
  }

  const buyerColCount = paymentsReadOnly ? 5 : 7
  const agentColCount = paymentsReadOnly ? 4 : 6

  return (
    <div className="relative min-h-[min(70vh,28rem)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm font-medium text-teal-700 hover:underline"
            >
              ← Back to plots
            </button>
          ) : null}
          <div
            className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${showBackButton ? 'mt-2' : ''}`}
          >
            <h2 className="text-xl font-semibold text-slate-900">
              Plot payment transactions
              <span className="font-semibold text-slate-600"> · </span>
              <span className="font-semibold text-slate-900">{plotNumberDisplay}</span>
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Buyer and agent payment lines for this plot.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setSaleSheetOpen(true)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Edit purchaser &amp; sale…
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="mt-6 space-y-8">
          {sale?.combinedGroupId ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
              <p className="font-semibold">Combined sale</p>
              <p className="mt-1 text-violet-900/90">
                Purchaser and sale amounts below apply to all {sale.combinedPlotIds?.length ?? 0} plots
                in this deal; payment lines are shared. Use <strong>Edit purchaser &amp; sale…</strong>{' '}
                to change terms or the plot list.
              </p>
              {sale.purchaserName?.trim() ? (
                <p className="mt-2 text-violet-950">
                  <span className="font-medium text-violet-800">Purchaser:</span>{' '}
                  {sale.purchaserName.trim()}
                </p>
              ) : null}
              {sale.subregistrarRegistrationDate?.trim() ? (
                <p className="mt-1 text-sm text-violet-950">
                  <span className="font-medium text-violet-800">Subregistrar registration:</span>{' '}
                  {sale.subregistrarRegistrationDate.trim().slice(0, 10)}
                </p>
              ) : null}
              {sale.combinedDisplayName?.trim() ? (
                <p className="mt-1 text-xs text-violet-800">Label: {sale.combinedDisplayName.trim()}</p>
              ) : null}
            </div>
          ) : null}

          {paymentsLocked && !readOnly ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Payment transactions locked</p>
              <p className="mt-1 text-amber-900/90">
                Open <strong>Edit purchaser &amp; sale…</strong> and turn off &quot;Lock payment
                edits&quot; to change payment lines.
              </p>
            </div>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
            <h3 className="text-sm font-semibold text-slate-900">Sale summary</h3>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Purchaser</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{sale?.purchaserName?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Subregistrar registration date</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {sale?.subregistrarRegistrationDate?.trim().slice(0, 10) || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Negotiated final</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-slate-900">
                  <MoneyInrShorthand amount={sale?.negotiatedFinalPrice ?? null} currency={currency} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Agent commission</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {sale?.agentCommissionPercent != null
                    ? `${sale.agentCommissionPercent}%`
                    : '—'}{' '}
                  /{' '}
                  <MoneyInrShorthand
                    amount={sale?.agentCommissionAmount ?? null}
                    currency={currency}
                    className="tabular-nums"
                  />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Stamp duty / Agreement</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-slate-900">
                  <MoneyInrShorthand amount={sale?.stampDutyPrice ?? null} currency={currency} /> /{' '}
                  <MoneyInrShorthand amount={sale?.agreementPrice ?? null} currency={currency} />
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm md:px-4 md:py-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment summary
              </h4>
              <dl className="mt-2 text-sm">
                <div>
                  <dt className="text-slate-500">Buyer payments by mode</dt>
                  <dd className="mt-1">
                    {buyerPaymentAgg.byModeSorted.length === 0 ? (
                      <span className="text-slate-600">No amounts recorded by mode yet.</span>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {buyerPaymentAgg.byModeSorted.map(([mode, amt]) => (
                          <li
                            key={mode}
                            className="flex justify-between gap-3 py-0.5 text-sm leading-tight first:pt-0"
                          >
                            <span className="text-slate-800">{mode}</span>
                            <span className="shrink-0 tabular-nums font-medium text-slate-900">
                              <MoneyInrShorthand amount={amt} currency={currency} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {buyerPaymentAgg.linesWithoutAmount > 0 ? (
                      <p className="mt-1.5 text-xs text-amber-800/90">
                        {buyerPaymentAgg.linesWithoutAmount} line
                        {buyerPaymentAgg.linesWithoutAmount === 1 ? '' : 's'} missing an amount (excluded
                        from totals).
                      </p>
                    ) : null}
                  </dd>
                </div>
                <div className="mt-2 grid gap-3 border-t border-slate-200 pt-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Total buyer payments</dt>
                    <dd className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
                      <MoneyInrShorthand amount={buyerPaymentAgg.total} currency={currency} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Outstanding to close sale</dt>
                    <dd
                      className={`mt-0.5 text-base font-semibold tabular-nums ${
                        !hasNegotiated
                          ? 'text-slate-500'
                          : outstanding != null && outstanding > 0
                            ? 'text-amber-800'
                            : outstanding != null && outstanding < 0
                              ? 'text-emerald-800'
                              : 'text-slate-900'
                      }`}
                    >
                      {!hasNegotiated ? (
                        'Set negotiated final price to compute'
                      ) : (
                        <MoneyInrShorthand amount={outstanding} currency={currency} />
                      )}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Buyer payment lines</h3>
              {!paymentsReadOnly ? (
                <button
                  type="button"
                  onClick={openAddPayment}
                  className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Add payment…
                </button>
              ) : null}
            </div>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {!paymentsReadOnly ? (
                      <th className="min-w-[5.5rem] px-2 py-2 text-center" scope="col">
                        <span className="sr-only">Edit or duplicate payment</span>
                      </th>
                    ) : null}
                    <th className="px-3 py-2 text-right tabular-nums">Amount</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="min-w-[8rem] px-3 py-2">Account</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Notes</th>
                    {!paymentsReadOnly ? (
                      <th className="w-12 px-2 py-2 text-center" scope="col">
                        <span className="sr-only">Delete</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={buyerColCount} className="px-3 py-6 text-center text-slate-500">
                        No payments yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className={buyerPaymentRowClass(p.paymentMode)}>
                        {!paymentsReadOnly ? (
                          <td className="px-2 py-2 align-middle">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                className={iconBtnClass('neutral')}
                                aria-label="Edit payment"
                                onClick={() => openEditPayment(p)}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className={iconBtnClass('neutral')}
                                aria-label="Duplicate as new payment"
                                onClick={() => openCopyPayment(p)}
                              >
                                <CopyIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        ) : null}
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          <MoneyInrShorthand amount={p.amount ?? null} currency={currency} />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {p.paymentMode?.trim() || '—'}
                        </td>
                        <td className="max-w-[14rem] truncate px-3 py-2 text-slate-700" title={p.accountId ? accountNameById.get(p.accountId) : undefined}>
                          {p.accountId ? (accountNameById.get(p.accountId) ?? '—') : '—'}
                        </td>
                        <td className="px-3 py-2">{p.paidDate?.trim() || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{p.notes?.trim() || '—'}</td>
                        {!paymentsReadOnly ? (
                          <td className="px-2 py-2 text-center align-middle">
                            <button
                              type="button"
                              className={iconBtnClass('danger')}
                              aria-label="Delete payment"
                              onClick={() => void deletePayment(p.id)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Agent commission payments</h3>
              {!paymentsReadOnly ? (
                <button
                  type="button"
                  onClick={openAddAgentPayment}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Add agent payment…
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Record amounts paid to the selling agent (date, mode, amount, notes).
            </p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {!paymentsReadOnly ? (
                      <th className="w-12 px-2 py-2 text-center" scope="col">
                        <span className="sr-only">Edit</span>
                      </th>
                    ) : null}
                    <th className="px-3 py-2 text-right tabular-nums">Amount</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Notes</th>
                    {!paymentsReadOnly ? (
                      <th className="w-12 px-2 py-2 text-center" scope="col">
                        <span className="sr-only">Delete</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {agentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={agentColCount} className="px-3 py-6 text-center text-slate-500">
                        No agent payments recorded.
                      </td>
                    </tr>
                  ) : (
                    agentPayments.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        {!paymentsReadOnly ? (
                          <td className="px-2 py-2 text-center align-middle">
                            <button
                              type="button"
                              className={iconBtnClass('neutral')}
                              aria-label="Edit agent payment"
                              onClick={() => openEditAgentPayment(p)}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </td>
                        ) : null}
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          <MoneyInrShorthand amount={p.amount ?? null} currency={currency} />
                        </td>
                        <td className="px-3 py-2">{p.paymentMode?.trim() || '—'}</td>
                        <td className="px-3 py-2">{p.paidDate?.trim() || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{p.notes?.trim() || '—'}</td>
                        {!paymentsReadOnly ? (
                          <td className="px-2 py-2 text-center align-middle">
                            <button
                              type="button"
                              className={iconBtnClass('danger')}
                              aria-label="Delete agent payment"
                              onClick={() => void deleteAgentPayment(p.id)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <PlotPaymentSheet
        open={paymentSheetOpen}
        onClose={closePaymentSheet}
        title={
          paymentSheetMode === 'add'
            ? paymentSheetFromDuplicate
              ? 'Duplicate buyer payment'
              : 'Add buyer payment'
            : 'Edit buyer payment'
        }
        submitLabel={paymentSheetMode === 'add' ? 'Add payment' : 'Save changes'}
        saving={savingPayment}
        initialAmount={sheetInitialAmount}
        initialMode={sheetInitialMode}
        initialPaidDate={sheetInitialDate}
        initialNotes={sheetInitialNotes}
        initialAccountId={sheetInitialAccountId}
        accountChoices={buyerAccountChoices}
        onSubmit={submitPaymentSheet}
        readOnly={paymentsReadOnly}
      />

      <PlotPaymentSheet
        open={agentSheetOpen}
        onClose={closeAgentPaymentSheet}
        title={agentSheetMode === 'add' ? 'Add agent payment' : 'Edit agent payment'}
        submitLabel={agentSheetMode === 'add' ? 'Add payment' : 'Save changes'}
        saving={savingAgentPayment}
        initialAmount={agentSheetInitialAmount}
        initialMode={agentSheetInitialMode}
        initialPaidDate={agentSheetInitialDate}
        initialNotes={agentSheetInitialNotes}
        onSubmit={submitAgentPaymentSheet}
        readOnly={paymentsReadOnly}
      />

      <PlotSaleDetailsSheet
        open={saleSheetOpen}
        onClose={() => setSaleSheetOpen(false)}
        projectId={projectId}
        plot={plot}
        projectPlots={projectPlots}
        sale={sale}
        onSaved={setSale}
        onRefresh={load}
        onProjectRefresh={onProjectRefresh}
        onError={onError}
        onEditCombinedSale={onEditCombinedSale}
        readOnly={readOnly}
      />
    </div>
  )
}
