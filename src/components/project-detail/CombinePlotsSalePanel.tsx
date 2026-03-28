import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { LandPlot } from '../../types'
import { plotStatusLabel } from './constants'

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

function resetSharedSaleForm(
  setPurchaserName: (v: string) => void,
  setSubregistrarRegistrationDate: (v: string) => void,
  setNegotiatedFinalPrice: (v: string) => void,
  setAgentCommissionPercent: (v: string) => void,
  setAgentCommissionAmount: (v: string) => void,
  setStampDutyPrice: (v: string) => void,
  setAgreementPrice: (v: string) => void,
  setCurrency: (v: string) => void,
  setPaymentsLocked: (v: boolean) => void,
  defaultCurrency: string,
) {
  setPurchaserName('')
  setSubregistrarRegistrationDate('')
  setNegotiatedFinalPrice('')
  setAgentCommissionPercent('')
  setAgentCommissionAmount('')
  setStampDutyPrice('')
  setAgreementPrice('')
  setCurrency(defaultCurrency.trim() || 'INR')
  setPaymentsLocked(false)
}

export function CombinePlotsSalePanel({
  projectId,
  plots,
  mode,
  onClose,
  onRefresh,
  onError,
  readOnly = false,
  className = '',
}: {
  projectId: string
  plots: LandPlot[]
  mode: 'create' | { editGroupId: string }
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  readOnly?: boolean
  className?: string
}) {
  const editGroupId = mode === 'create' ? null : mode.editGroupId
  const defaultCurrency = useMemo(() => {
    const first = plots[0]
    return (first?.currency ?? 'INR').trim() || 'INR'
  }, [plots])

  const [displayName, setDisplayName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(editGroupId != null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(false)

  const [purchaserName, setPurchaserName] = useState('')
  const [subregistrarRegistrationDate, setSubregistrarRegistrationDate] = useState('')
  const [negotiatedFinalPrice, setNegotiatedFinalPrice] = useState('')
  const [agentCommissionPercent, setAgentCommissionPercent] = useState('')
  const [agentCommissionAmount, setAgentCommissionAmount] = useState('')
  const [stampDutyPrice, setStampDutyPrice] = useState('')
  const [agreementPrice, setAgreementPrice] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [paymentsLocked, setPaymentsLocked] = useState(false)

  const negotiatedNfp = useCallback((): number | undefined => {
    const n = numOrUndef(negotiatedFinalPrice)
    return n != null && n > 0 ? n : undefined
  }, [negotiatedFinalPrice])

  const syncSaleFromGroup = useCallback(
    (g: Awaited<ReturnType<typeof api.getCombinedPlotSaleGroup>>) => {
      setPurchaserName(g.purchaserName ?? '')
      setSubregistrarRegistrationDate(
        g.subregistrarRegistrationDate?.trim().slice(0, 10) ?? '',
      )
      setNegotiatedFinalPrice(
        g.negotiatedFinalPrice != null ? String(g.negotiatedFinalPrice) : '',
      )
      setAgentCommissionPercent(
        g.agentCommissionPercent != null ? String(g.agentCommissionPercent) : '',
      )
      {
        const nfp = g.negotiatedFinalPrice
        const pct = g.agentCommissionPercent
        if (g.agentCommissionAmount !== undefined && g.agentCommissionAmount !== null) {
          setAgentCommissionAmount(String(g.agentCommissionAmount))
        } else if (nfp != null && nfp > 0 && pct != null) {
          setAgentCommissionAmount(String(round2((nfp * pct) / 100)))
        } else {
          setAgentCommissionAmount('')
        }
      }
      setStampDutyPrice(g.stampDutyPrice != null ? String(g.stampDutyPrice) : '')
      setAgreementPrice(g.agreementPrice != null ? String(g.agreementPrice) : '')
      setCurrency(g.currency || defaultCurrency)
      setPaymentsLocked(g.paymentsLocked === true)
    },
    [defaultCurrency],
  )

  const loadEdit = useCallback(async () => {
    if (!editGroupId) return
    setLoading(true)
    onError(null)
    try {
      const g = await api.getCombinedPlotSaleGroup(editGroupId, projectId)
      setDisplayName(g.displayName)
      setSelected(new Set(g.plotIds))
      syncSaleFromGroup(g)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load group')
    } finally {
      setLoading(false)
    }
  }, [editGroupId, projectId, onError, syncSaleFromGroup])

  useEffect(() => {
    if (editGroupId) void loadEdit()
    else {
      setDisplayName('')
      setSelected(new Set())
      resetSharedSaleForm(
        setPurchaserName,
        setSubregistrarRegistrationDate,
        setNegotiatedFinalPrice,
        setAgentCommissionPercent,
        setAgentCommissionAmount,
        setStampDutyPrice,
        setAgreementPrice,
        setCurrency,
        setPaymentsLocked,
        defaultCurrency,
      )
    }
  }, [editGroupId, loadEdit, defaultCurrency])

  const toggle = (plotId: string) => {
    if (readOnly) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(plotId)) next.delete(plotId)
      else next.add(plotId)
      return next
    })
  }

  const eligiblePlots = useMemo(() => {
    return [...plots].sort((a, b) => {
      const na = a.plotNumber?.trim() || a.id
      const nb = b.plotNumber?.trim() || b.id
      return na.localeCompare(nb)
    })
  }, [plots])

  const onNegotiatedFinalPriceChange = (v: string) => {
    setNegotiatedFinalPrice(v)
    const nfp = numOrUndef(v)
    if (nfp == null || nfp <= 0) return
    const pct = numOrUndef(agentCommissionPercent)
    const amt = numOrUndef(agentCommissionAmount)
    if (pct != null) {
      setAgentCommissionAmount(String(round2((nfp * pct) / 100)))
    } else if (amt != null) {
      const p = (amt / nfp) * 100
      setAgentCommissionPercent(String(round4(Math.min(100, Math.max(0, p)))))
    }
  }

  const onAgentCommissionPercentChange = (v: string) => {
    setAgentCommissionPercent(v)
    const nfp = negotiatedNfp()
    const pct = numOrUndef(v)
    if (nfp != null && pct != null) setAgentCommissionAmount(String(round2((nfp * pct) / 100)))
  }

  const onAgentCommissionAmountChange = (v: string) => {
    setAgentCommissionAmount(v)
    const nfp = negotiatedNfp()
    const amt = numOrUndef(v)
    if (nfp != null && amt != null) {
      const p = (amt / nfp) * 100
      setAgentCommissionPercent(String(round4(Math.min(100, Math.max(0, p)))))
    }
  }

  const salePayload = () => ({
    purchaserName: purchaserName.trim() || null,
    subregistrarRegistrationDate: subregistrarRegistrationDate.trim()
      ? subregistrarRegistrationDate.trim().slice(0, 10)
      : null,
    negotiatedFinalPrice: numOrUndef(negotiatedFinalPrice) ?? null,
    agentCommissionPercent: numOrUndef(agentCommissionPercent) ?? null,
    agentCommissionAmount: numOrUndef(agentCommissionAmount) ?? null,
    stampDutyPrice: numOrUndef(stampDutyPrice) ?? null,
    agreementPrice: numOrUndef(agreementPrice) ?? null,
    currency: currency.trim() || 'INR',
    paymentsLocked,
  })

  const submit = async () => {
    const ids = [...selected]
    if (ids.length < 2) {
      onError('Select at least two plots to sell together.')
      return
    }
    setSaving(true)
    onError(null)
    try {
      const sp = salePayload()
      if (editGroupId) {
        await api.updateCombinedPlotSaleGroup(editGroupId, projectId, {
          displayName: displayName.trim(),
          plotIds: ids,
          ...sp,
        })
      } else {
        await api.createCombinedPlotSaleGroup({
          projectId,
          displayName: displayName.trim(),
          plotIds: ids,
          ...sp,
        })
      }
      await onRefresh()
      onClose()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const removeGroup = async () => {
    if (!editGroupId) return
    setDeleting(true)
    onError(null)
    try {
      await api.deleteCombinedPlotSaleGroup(editGroupId, projectId)
      await onRefresh()
      onClose()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not remove combined sale')
    } finally {
      setDeleting(false)
      setRemoveConfirm(false)
    }
  }

  const labelCls = 'text-xs font-medium text-slate-600'
  const inputCls = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'

  return (
    <aside
      className={`flex h-full flex-col border-l border-slate-200 bg-white ${className}`}
      aria-labelledby="combine-plots-title"
    >
      <div className="shrink-0 border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="combine-plots-title" className="text-lg font-semibold text-slate-900">
            {editGroupId ? 'Combined plot sale' : 'Combine plots for one sale'}
          </h2>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <span className="font-medium">One buyer, several plots:</span> checked plots share the same
          purchaser and sale terms and one payment history. Open <strong>Sale &amp; payments</strong> from
          any plot in the group to record money received—it applies to the whole set.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <label className="block">
              <span className={labelCls}>Label (optional)</span>
              <input
                className={inputCls}
                placeholder="e.g. Sharma family — lots 4 & 7"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={readOnly}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Shown on the plots table so you can spot the deal at a glance.
              </span>
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Shared purchaser &amp; sale terms</p>
              <p className="mt-1 text-xs text-slate-600">
                Same fields as a single-plot sale. You can change these later from{' '}
                <strong>Edit purchaser &amp; sale</strong> on the payment screen.
              </p>
              {!readOnly ? (
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className={labelCls}>Purchaser name</span>
                    <input
                      className={inputCls}
                      value={purchaserName}
                      onChange={(e) => setPurchaserName(e.target.value)}
                      placeholder="Buyer name"
                    />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Subregistrar registration date</span>
                    <input
                      className={inputCls}
                      type="date"
                      value={subregistrarRegistrationDate}
                      onChange={(e) => setSubregistrarRegistrationDate(e.target.value)}
                    />
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className={labelCls}>Payment transactions</p>
                    <label className="mt-2 flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-slate-300"
                        checked={paymentsLocked}
                        onChange={(e) => setPaymentsLocked(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">
                        <span className="font-medium">Lock payment edits</span>
                        <span className="mt-1 block text-xs font-normal text-slate-600">
                          While locked, shared payment lines cannot be added, edited, or deleted until
                          unlocked.
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
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className={labelCls}>Purchaser name</dt>
                      <dd className="mt-0.5 text-slate-900">{purchaserName.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt className={labelCls}>Subregistrar registration date</dt>
                      <dd className="mt-0.5 text-slate-900">
                        {subregistrarRegistrationDate.trim().slice(0, 10) || '—'}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-xs text-amber-800/90">View-only: sale terms cannot be edited here.</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Plots in this combined sale
              </p>
              <ul className="mt-2 max-h-[min(40vh,16rem)] space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {eligiblePlots.map((p) => {
                  const inGroup = selected.has(p.id)
                  const blocked =
                    readOnly ||
                    (p.combinedSale != null &&
                      (editGroupId == null || p.combinedSale.groupId !== editGroupId))
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm ${
                          inGroup ? 'bg-violet-50' : 'hover:bg-slate-50'
                        } ${blocked ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={inGroup}
                          disabled={blocked}
                          onChange={() => toggle(p.id)}
                        />
                        <span>
                          <span className="font-medium text-slate-900">
                            {p.plotNumber?.trim()
                              ? `Plot #${p.plotNumber.trim()}`
                              : `Plot ${p.id.slice(0, 8)}…`}
                          </span>
                          <span className="ml-2 text-slate-500">{plotStatusLabel(p.status)}</span>
                          {p.combinedSale != null &&
                          (editGroupId == null || p.combinedSale.groupId !== editGroupId) ? (
                            <span className="mt-0.5 block text-xs text-amber-800">
                              Already in another combined sale — edit that group to change membership.
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-slate-100 pt-4">
        {!readOnly ? (
          <>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void submit()}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editGroupId ? 'Save changes' : 'Create combined sale'}
            </button>
            {editGroupId ? (
              removeConfirm ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <p>
                    This deletes the group and all shared payment lines for this deal. Plots stay; sale
                    data is removed.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                      onClick={() => void removeGroup()}
                    >
                      {deleting ? 'Removing…' : 'Yes, remove combined sale'}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                      onClick={() => setRemoveConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full text-sm font-medium text-red-700 hover:underline"
                  onClick={() => setRemoveConfirm(true)}
                >
                  Remove combined sale…
                </button>
              )
            ) : null}
          </>
        ) : (
          <p className="text-xs text-amber-800/90">View-only: cannot change combined sales.</p>
        )}
      </div>
    </aside>
  )
}
