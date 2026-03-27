import { useCallback, useEffect, useState } from 'react'
import * as api from '../../api/dataApi'
import type { LandPlot, PlotSale, PlotSalePayment } from '../../types'
import { MoneyInrShorthand } from '../MoneyInrShorthand'

export function PlotTransactionsView({
  projectId,
  plot,
  projectPlots,
  onBack,
  onOpenSalePanel,
  onEditCombinedSale,
  readOnly = false,
}: {
  projectId: string
  plot: LandPlot
  projectPlots: LandPlot[]
  onBack: () => void
  onOpenSalePanel: () => void
  onEditCombinedSale?: (groupId: string) => void
  readOnly?: boolean
}) {
  const [sale, setSale] = useState<PlotSale | null>(null)
  const [payments, setPayments] = useState<PlotSalePayment[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)

  const load = useCallback(async () => {
    setBusy(true)
    setErr(null)
    try {
      const [s, p] = await Promise.all([
        api.getPlotSale(plot.id, projectId),
        api.listPlotSalePayments(plot.id, projectId),
      ])
      setSale(s)
      setPayments(p)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setBusy(false)
    }
  }, [plot.id, projectId])

  useEffect(() => {
    void load()
  }, [load])

  const cur = sale?.currency ?? plot.currency

  const combinedLabels =
    sale?.combinedPlotIds?.map((pid) => {
      const lp = projectPlots.find((x) => x.id === pid)
      return lp?.plotNumber?.trim() ? `#${lp.plotNumber.trim()}` : pid.slice(0, 8)
    }) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to plots
          </button>
          <div>
            <h2 className="text-lg font-medium text-slate-900">Plot payment transactions</h2>
            <p className="mt-1 text-sm text-slate-600">
              {sale?.combinedGroupId ? (
                <>
                  Combined sale — viewing from plot{' '}
                  {plot.plotNumber?.trim() ? `#${plot.plotNumber.trim()}` : plot.id.slice(0, 8)}
                </>
              ) : (
                <>
                  Plot {plot.plotNumber?.trim() ? `#${plot.plotNumber.trim()}` : plot.id.slice(0, 8)}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && sale?.combinedGroupId && onEditCombinedSale ? (
            <button
              type="button"
              onClick={() => onEditCombinedSale(sale.combinedGroupId!)}
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100"
            >
              Combined plots…
            </button>
          ) : null}
          {!readOnly ? (
            <button
              type="button"
              onClick={onOpenSalePanel}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Edit sale &amp; payments
            </button>
          ) : null}
        </div>
      </div>

      {sale?.combinedGroupId ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
          <p className="font-medium">These payments apply to every plot in this combined sale.</p>
          {combinedLabels.length > 0 ? (
            <p className="mt-2 font-mono text-xs">Plots: {combinedLabels.join(' · ')}</p>
          ) : null}
        </div>
      ) : null}

      {err ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
      ) : null}

      {busy ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {sale ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Sale summary</h3>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {sale.purchaserName ? (
                  <>
                    <dt className="text-slate-500">Purchaser</dt>
                    <dd className="font-medium text-slate-900">{sale.purchaserName}</dd>
                  </>
                ) : null}
                {sale.negotiatedFinalPrice != null ? (
                  <>
                    <dt className="text-slate-500">Negotiated final price</dt>
                    <dd className="tabular-nums font-medium">
                      <MoneyInrShorthand amount={sale.negotiatedFinalPrice} currency={cur} />
                    </dd>
                  </>
                ) : null}
                {sale.stampDutyPrice != null ? (
                  <>
                    <dt className="text-slate-500">Stamp duty</dt>
                    <dd className="tabular-nums">
                      <MoneyInrShorthand amount={sale.stampDutyPrice} currency={cur} />
                    </dd>
                  </>
                ) : null}
                {sale.agreementPrice != null ? (
                  <>
                    <dt className="text-slate-500">Agreement price</dt>
                    <dd className="tabular-nums">
                      <MoneyInrShorthand amount={sale.agreementPrice} currency={cur} />
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No sale record saved yet. Use &quot;Edit sale &amp; payments&quot; to add details.
            </p>
          )}

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
            </div>
            {payments.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No payment lines yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-800">
                          {p.paidDate}
                        </td>
                        <td className="px-4 py-3 text-slate-800">{p.paymentMode}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {p.amount != null ? (
                            <MoneyInrShorthand amount={p.amount} currency={cur} />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="max-w-md px-4 py-3 text-slate-600">{p.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
