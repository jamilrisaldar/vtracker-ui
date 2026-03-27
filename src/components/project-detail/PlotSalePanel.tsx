import { useCallback, useEffect, useState } from 'react'
import * as api from '../../api/dataApi'
import type { LandPlot, PlotSale, PlotSalePayment } from '../../types'
import { MoneyInrShorthand } from '../MoneyInrShorthand'

function numOrUndef(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export function PlotSalePanel({
  projectId,
  plot,
  projectPlots,
  onClose,
  onRefresh,
  onError,
  onViewTransactions,
  onEditCombinedSale,
  readOnly = false,
  className = '',
}: {
  projectId: string
  plot: LandPlot
  /** All plots in the project (for combined-sale labels). */
  projectPlots: LandPlot[]
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  onViewTransactions: () => void
  onEditCombinedSale?: (groupId: string) => void
  readOnly?: boolean
  className?: string
}) {
  const [sale, setSale] = useState<PlotSale | null>(null)
  const [payments, setPayments] = useState<PlotSalePayment[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [purchaserName, setPurchaserName] = useState('')
  const [negotiatedFinalPrice, setNegotiatedFinalPrice] = useState('')
  const [agentCommissionPercent, setAgentCommissionPercent] = useState('')
  const [agentCommissionAmount, setAgentCommissionAmount] = useState('')
  const [stampDutyPrice, setStampDutyPrice] = useState('')
  const [agreementPrice, setAgreementPrice] = useState('')
  const [currency, setCurrency] = useState(plot.currency || 'INR')

  const [payMode, setPayMode] = useState('')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [addingPay, setAddingPay] = useState(false)

  const [editingPayId, setEditingPayId] = useState<string | null>(null)
  const [editPayMode, setEditPayMode] = useState('')
  const [editPayDate, setEditPayDate] = useState('')
  const [editPayAmount, setEditPayAmount] = useState('')
  const [editPayNotes, setEditPayNotes] = useState('')

  const reload = useCallback(async () => {
    setLoadErr(null)
    try {
      const [s, p] = await Promise.all([
        api.getPlotSale(plot.id, projectId),
        api.listPlotSalePayments(plot.id, projectId),
      ])
      setSale(s)
      setPayments(p)
      if (s) {
        setPurchaserName(s.purchaserName ?? '')
        setNegotiatedFinalPrice(
          s.negotiatedFinalPrice != null ? String(s.negotiatedFinalPrice) : '',
        )
        setAgentCommissionPercent(
          s.agentCommissionPercent != null ? String(s.agentCommissionPercent) : '',
        )
        setAgentCommissionAmount(
          s.agentCommissionAmount != null ? String(s.agentCommissionAmount) : '',
        )
        setStampDutyPrice(s.stampDutyPrice != null ? String(s.stampDutyPrice) : '')
        setAgreementPrice(s.agreementPrice != null ? String(s.agreementPrice) : '')
        setCurrency(s.currency || plot.currency || 'INR')
      } else {
        setPurchaserName('')
        setNegotiatedFinalPrice('')
        setAgentCommissionPercent('')
        setAgentCommissionAmount('')
        setStampDutyPrice('')
        setAgreementPrice('')
        setCurrency(plot.currency || 'INR')
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [plot.id, plot.currency, projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveSale = async () => {
    setSaving(true)
    onError(null)
    try {
      const row = await api.upsertPlotSale(plot.id, projectId, {
        purchaserName: purchaserName.trim() || null,
        negotiatedFinalPrice: numOrUndef(negotiatedFinalPrice) ?? null,
        agentCommissionPercent: numOrUndef(agentCommissionPercent) ?? null,
        agentCommissionAmount: numOrUndef(agentCommissionAmount) ?? null,
        stampDutyPrice: numOrUndef(stampDutyPrice) ?? null,
        agreementPrice: numOrUndef(agreementPrice) ?? null,
        currency: currency.trim() || 'INR',
      })
      setSale(row)
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addPayment = async () => {
    if (!payMode.trim()) {
      onError('Enter payment mode')
      return
    }
    setAddingPay(true)
    onError(null)
    try {
      const row = await api.createPlotSalePayment(plot.id, projectId, {
        paymentMode: payMode.trim(),
        paidDate: payDate,
        amount: numOrUndef(payAmount) ?? null,
        notes: payNotes.trim() || null,
      })
      setPayments((prev) =>
        [...prev, row].sort(
          (a, b) => b.paidDate.localeCompare(a.paidDate) || b.createdAt.localeCompare(a.createdAt),
        ),
      )
      setPayMode('')
      setPayAmount('')
      setPayNotes('')
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not add payment')
    } finally {
      setAddingPay(false)
    }
  }

  const startEditPay = (p: PlotSalePayment) => {
    setEditingPayId(p.id)
    setEditPayMode(p.paymentMode)
    setEditPayDate(p.paidDate)
    setEditPayAmount(p.amount != null ? String(p.amount) : '')
    setEditPayNotes(p.notes ?? '')
  }

  const saveEditPay = async () => {
    if (!editingPayId) return
    onError(null)
    try {
      const row = await api.updatePlotSalePayment(plot.id, editingPayId, projectId, {
        paymentMode: editPayMode.trim(),
        paidDate: editPayDate,
        amount: numOrUndef(editPayAmount) ?? null,
        notes: editPayNotes.trim() || null,
      })
      setPayments((prev) => prev.map((x) => (x.id === row.id ? row : x)))
      setEditingPayId(null)
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const removePay = async (paymentId: string) => {
    onError(null)
    try {
      await api.deletePlotSalePayment(plot.id, paymentId, projectId)
      setPayments((prev) => prev.filter((x) => x.id !== paymentId))
      await onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const labelCls = 'text-xs font-medium text-slate-600'
  const inputCls = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'

  const combinedLabels =
    sale?.combinedPlotIds?.map((pid) => {
      const lp = projectPlots.find((x) => x.id === pid)
      return lp?.plotNumber?.trim() ? `#${lp.plotNumber.trim()}` : pid.slice(0, 8)
    }) ?? []

  return (
    <aside
      className={`flex h-full flex-col border-l border-slate-200 bg-white ${className}`}
      aria-labelledby="plot-sale-panel-title"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 id="plot-sale-panel-title" className="text-lg font-semibold text-slate-900">
            Plot sale &amp; payments
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Plot {plot.plotNumber?.trim() ? `#${plot.plotNumber.trim()}` : plot.id.slice(0, 8)} —{' '}
            {plot.status.replace(/_/g, ' ')}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto py-6">
        {loadErr ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{loadErr}</p>
        ) : null}

        {sale?.combinedGroupId ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
            <p className="font-semibold">Combined sale — shared payment history</p>
            <p className="mt-1 text-violet-900/90">
              This plot is sold together with{' '}
              <strong>{Math.max(0, (sale.combinedPlotIds?.length ?? 1) - 1)}</strong> other
              {sale.combinedPlotIds && sale.combinedPlotIds.length === 2 ? ' plot' : ' plots'}. Any payment
              you add here counts toward the whole deal.
            </p>
            {combinedLabels.length > 0 ? (
              <p className="mt-2 font-mono text-xs text-violet-900">
                Plots: {combinedLabels.join(' · ')}
              </p>
            ) : null}
            {sale.combinedDisplayName?.trim() ? (
              <p className="mt-1 text-xs text-violet-800">Label: {sale.combinedDisplayName.trim()}</p>
            ) : null}
            {!readOnly && onEditCombinedSale ? (
              <button
                type="button"
                className="mt-3 text-sm font-medium text-violet-800 underline decoration-violet-400 hover:text-violet-950"
                onClick={() => onEditCombinedSale(sale.combinedGroupId!)}
              >
                Change which plots are in this sale
              </button>
            ) : null}
          </div>
        ) : null}

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Sale details</h3>
          <label className="block">
            <span className={labelCls}>Purchaser name</span>
            <input
              className={inputCls}
              value={purchaserName}
              onChange={(e) => setPurchaserName(e.target.value)}
              placeholder="Buyer name"
              disabled={readOnly}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Negotiated final price</span>
              <input
                className={inputCls}
                inputMode="decimal"
                value={negotiatedFinalPrice}
                onChange={(e) => setNegotiatedFinalPrice(e.target.value)}
                placeholder="0"
                disabled={readOnly}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Currency</span>
              <input
                className={inputCls}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={8}
                disabled={readOnly}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Agent commission %</span>
              <input
                className={inputCls}
                inputMode="decimal"
                value={agentCommissionPercent}
                onChange={(e) => setAgentCommissionPercent(e.target.value)}
                placeholder="0"
                disabled={readOnly}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Agent commission amount</span>
              <input
                className={inputCls}
                inputMode="decimal"
                value={agentCommissionAmount}
                onChange={(e) => setAgentCommissionAmount(e.target.value)}
                placeholder="0"
                disabled={readOnly}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Stamp duty</span>
              <input
                className={inputCls}
                inputMode="decimal"
                value={stampDutyPrice}
                onChange={(e) => setStampDutyPrice(e.target.value)}
                placeholder="0"
                disabled={readOnly}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Agreement price</span>
              <input
                className={inputCls}
                inputMode="decimal"
                value={agreementPrice}
                onChange={(e) => setAgreementPrice(e.target.value)}
                placeholder="0"
                disabled={readOnly}
              />
            </label>
          </div>
          {!readOnly ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSale()}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : sale ? 'Update sale details' : 'Save sale details'}
            </button>
          ) : (
            <p className="text-xs text-amber-800/90">View-only: sale details cannot be edited.</p>
          )}
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Buyer payments</h3>
            <button
              type="button"
              className="text-sm font-medium text-teal-700 hover:text-teal-800"
              onClick={onViewTransactions}
            >
              Open payments view
            </button>
          </div>

          {!readOnly ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
            <p className="text-xs text-slate-600">Add a payment line</p>
            <label className="block">
              <span className={labelCls}>Mode of payment</span>
              <input
                className={inputCls}
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
                placeholder="Cash, RTGS, Cheque…"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Date</span>
                <input
                  type="date"
                  className={inputCls}
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Amount (optional)</span>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
            <label className="block">
              <span className={labelCls}>Notes</span>
              <textarea
                className={`${inputCls} min-h-[4rem] resize-y`}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                rows={2}
              />
            </label>
            <button
              type="button"
              disabled={addingPay}
              onClick={() => void addPayment()}
              className="rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
            >
              {addingPay ? 'Adding…' : 'Add payment'}
            </button>
          </div>
          ) : null}

          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm"
                >
                  {editingPayId === p.id ? (
                    <div className="space-y-2">
                      <input
                        className={inputCls}
                        value={editPayMode}
                        onChange={(e) => setEditPayMode(e.target.value)}
                      />
                      <input type="date" className={inputCls} value={editPayDate} onChange={(e) => setEditPayDate(e.target.value)} />
                      <input
                        className={inputCls}
                        inputMode="decimal"
                        value={editPayAmount}
                        onChange={(e) => setEditPayAmount(e.target.value)}
                        placeholder="Amount"
                      />
                      <textarea
                        className={inputCls}
                        value={editPayNotes}
                        onChange={(e) => setEditPayNotes(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white"
                          onClick={() => void saveEditPay()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700"
                          onClick={() => setEditingPayId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-slate-900">{p.paymentMode}</span>
                        <span className="tabular-nums text-slate-600">{p.paidDate}</span>
                      </div>
                      {p.amount != null ? (
                        <p className="mt-1 font-medium tabular-nums text-slate-800">
                          <MoneyInrShorthand amount={p.amount} currency={sale?.currency ?? plot.currency} />
                        </p>
                      ) : null}
                      {p.notes?.trim() ? (
                        <p className="mt-2 text-slate-600">{p.notes}</p>
                      ) : null}
                      {!readOnly ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="text-xs font-medium text-teal-700 hover:underline"
                            onClick={() => startEditPay(p)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-red-600 hover:underline"
                            onClick={() => void removePay(p.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  )
}
