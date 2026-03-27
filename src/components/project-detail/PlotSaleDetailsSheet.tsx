import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../../api/dataApi'
import type { LandPlot, PlotSale } from '../../types'

function numOrUndef(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Right-hand sheet (local overlay) for editing purchaser and sale terms.
 * Renders inside a positioned parent; does not cover the full viewport.
 */
export function PlotSaleDetailsSheet({
  open,
  onClose,
  projectId,
  plot,
  projectPlots,
  sale,
  onSaved,
  onRefresh,
  onProjectRefresh,
  onError,
  onEditCombinedSale,
  readOnly = false,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  plot: LandPlot
  projectPlots: LandPlot[]
  sale: PlotSale | null
  onSaved: (row: PlotSale) => void
  onRefresh: () => Promise<void>
  onProjectRefresh?: () => Promise<void>
  onError: (msg: string | null) => void
  onEditCombinedSale?: (groupId: string) => void
  readOnly?: boolean
}) {
  const [purchaserName, setPurchaserName] = useState('')
  const [negotiatedFinalPrice, setNegotiatedFinalPrice] = useState('')
  const [agentCommissionPercent, setAgentCommissionPercent] = useState('')
  const [agentCommissionAmount, setAgentCommissionAmount] = useState('')
  const [stampDutyPrice, setStampDutyPrice] = useState('')
  const [agreementPrice, setAgreementPrice] = useState('')
  const [currency, setCurrency] = useState(plot.currency || 'INR')
  const [paymentsLocked, setPaymentsLocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lockSaving, setLockSaving] = useState(false)

  const lastCommissionSource = useRef<'percent' | 'amount' | null>(null)

  const negotiatedNfp = useCallback((): number | undefined => {
    const n = numOrUndef(negotiatedFinalPrice)
    return n != null && n > 0 ? n : undefined
  }, [negotiatedFinalPrice])

  const syncFromSale = useCallback(() => {
    lastCommissionSource.current = null
    if (sale) {
      setPurchaserName(sale.purchaserName ?? '')
      setNegotiatedFinalPrice(
        sale.negotiatedFinalPrice != null ? String(sale.negotiatedFinalPrice) : '',
      )
      setAgentCommissionPercent(
        sale.agentCommissionPercent != null ? String(sale.agentCommissionPercent) : '',
      )
      {
        const nfp = sale.negotiatedFinalPrice
        const pct = sale.agentCommissionPercent
        if (sale.agentCommissionAmount !== undefined && sale.agentCommissionAmount !== null) {
          setAgentCommissionAmount(String(sale.agentCommissionAmount))
        } else if (nfp != null && nfp > 0 && pct != null) {
          setAgentCommissionAmount(String(round2((nfp * pct) / 100)))
        } else {
          setAgentCommissionAmount('')
        }
      }
      setStampDutyPrice(sale.stampDutyPrice != null ? String(sale.stampDutyPrice) : '')
      setAgreementPrice(sale.agreementPrice != null ? String(sale.agreementPrice) : '')
      setCurrency(sale.currency || plot.currency || 'INR')
      setPaymentsLocked(sale.paymentsLocked === true)
    } else {
      setPurchaserName('')
      setNegotiatedFinalPrice('')
      setAgentCommissionPercent('')
      setAgentCommissionAmount('')
      setStampDutyPrice('')
      setAgreementPrice('')
      setCurrency(plot.currency || 'INR')
      setPaymentsLocked(false)
    }
  }, [sale, plot.currency])

  useEffect(() => {
    if (open) syncFromSale()
  }, [open, syncFromSale])

  const onNegotiatedFinalPriceChange = (v: string) => {
    setNegotiatedFinalPrice(v)
    const nfp = numOrUndef(v)
    if (nfp == null || nfp <= 0) return
    const pct = numOrUndef(agentCommissionPercent)
    const amt = numOrUndef(agentCommissionAmount)
    if (pct != null) {
      lastCommissionSource.current = 'percent'
      setAgentCommissionAmount(String(round2((nfp * pct) / 100)))
    } else if (amt != null) {
      lastCommissionSource.current = 'amount'
      const p = (amt / nfp) * 100
      setAgentCommissionPercent(String(round4(Math.min(100, Math.max(0, p)))))
    }
  }

  const onAgentCommissionPercentChange = (v: string) => {
    lastCommissionSource.current = 'percent'
    setAgentCommissionPercent(v)
    const nfp = negotiatedNfp()
    const pct = numOrUndef(v)
    if (nfp != null && pct != null) setAgentCommissionAmount(String(round2((nfp * pct) / 100)))
  }

  const onAgentCommissionAmountChange = (v: string) => {
    lastCommissionSource.current = 'amount'
    setAgentCommissionAmount(v)
    const nfp = negotiatedNfp()
    const amt = numOrUndef(v)
    if (nfp != null && amt != null) {
      const p = (amt / nfp) * 100
      setAgentCommissionPercent(String(round4(Math.min(100, Math.max(0, p)))))
    }
  }

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
        paymentsLocked,
      })
      onSaved(row)
      await onRefresh()
      await onProjectRefresh?.()
      onClose()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const togglePaymentsLocked = async (next: boolean) => {
    setLockSaving(true)
    onError(null)
    try {
      const row = await api.upsertPlotSale(plot.id, projectId, { paymentsLocked: next })
      setPaymentsLocked(next)
      onSaved(row)
      await onRefresh()
      await onProjectRefresh?.()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setLockSaving(false)
    }
  }

  const labelCls = 'text-xs font-medium text-slate-600'
  const inputCls = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'

  const combinedLabels =
    sale?.combinedPlotIds?.map((pid) => {
      const lp = projectPlots.find((x) => x.id === pid)
      return lp?.plotNumber?.trim() ? `#${lp.plotNumber.trim()}` : pid.slice(0, 8)
    }) ?? []

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex min-h-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plot-sale-sheet-title"
    >
      <button
        type="button"
        className="min-h-0 min-w-0 flex-1 cursor-default bg-slate-900/15"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div className="flex h-screen min-h-0 w-full max-w-md shrink-0 flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 id="plot-sale-sheet-title" className="text-lg font-semibold text-slate-900">
              Purchaser &amp; sale terms
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Plot {plot.plotNumber?.trim() ? `#${plot.plotNumber.trim()}` : plot.id.slice(0, 8)}
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

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {sale?.combinedGroupId ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
              <p className="font-semibold">Combined sale</p>
              <p className="mt-1 text-violet-900/90">
                Edits apply to the whole deal ({sale.combinedPlotIds?.length ?? 0} plots).
              </p>
              {combinedLabels.length > 0 ? (
                <p className="mt-2 font-mono text-xs text-violet-900">{combinedLabels.join(' · ')}</p>
              ) : null}
              {sale.combinedDisplayName?.trim() ? (
                <p className="mt-1 text-xs text-violet-800">Label: {sale.combinedDisplayName.trim()}</p>
              ) : null}
              {!readOnly && onEditCombinedSale ? (
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-violet-800 underline"
                  onClick={() => {
                    onEditCombinedSale(sale.combinedGroupId!)
                    onClose()
                  }}
                >
                  Change which plots are included
                </button>
              ) : null}
            </div>
          ) : null}

          {readOnly ? (
            <p className="text-xs text-amber-800/90">View-only: sale details cannot be edited.</p>
          ) : (
            <>
              <label className="block">
                <span className={labelCls}>Purchaser name</span>
                <input
                  className={inputCls}
                  value={purchaserName}
                  onChange={(e) => setPurchaserName(e.target.value)}
                  placeholder="Buyer name"
                />
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                <p className={labelCls}>Payment transactions</p>
                <label className="mt-2 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-slate-300"
                    checked={paymentsLocked}
                    disabled={lockSaving || saving}
                    onChange={(e) => void togglePaymentsLocked(e.target.checked)}
                  />
                  <span className="text-sm text-slate-800">
                    <span className="font-medium">Lock payment edits</span>
                    <span className="mt-1 block text-xs font-normal text-slate-600">
                      While locked, payment lines cannot be added, edited, or deleted. Unlock anytime
                      from here.
                    </span>
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Negotiated final price</span>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={negotiatedFinalPrice}
                    onChange={(e) => onNegotiatedFinalPriceChange(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Currency</span>
                  <input
                    className={inputCls}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={8}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Agent commission % and amount stay in sync with the negotiated final price when you
                change either commission field.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Agent commission %</span>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={agentCommissionPercent}
                    onChange={(e) => onAgentCommissionPercentChange(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Agent commission amount</span>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={agentCommissionAmount}
                    onChange={(e) => onAgentCommissionAmountChange(e.target.value)}
                    placeholder="0"
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
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={saving || lockSaving}
                onClick={() => void saveSale()}
                className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : sale ? 'Save changes' : 'Save sale details'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
