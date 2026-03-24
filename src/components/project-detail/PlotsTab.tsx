import { useState } from 'react'
import * as api from '../../api/dataApi'
import type { LandPlot } from '../../types'
import { formatMoney } from '../../utils/format'
import { PlotAddEditPanel } from '../PlotAddEditPanel'
import { plotStatusLabel } from './constants'

function sqFt(plot: LandPlot): number {
  return plot.widthFeet * plot.lengthFeet
}

function trunc(s: string | undefined, max: number): string {
  if (!s) return '—'
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

export function PlotsTab({
  projectId,
  plots,
  onRefresh,
  onError,
}: {
  projectId: string
  plots: LandPlot[]
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
}) {
  const [panelMode, setPanelMode] = useState<'add' | 'edit' | null>(null)
  const [panelPlot, setPanelPlot] = useState<LandPlot | null>(null)

  const closePanel = () => {
    setPanelMode(null)
    setPanelPlot(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Land plots</h2>
          <p className="mt-1 text-sm text-slate-600">
            Track dimensions (feet), asking price per sq ft, purchase price, and sale status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPanelPlot(null)
            setPanelMode('add')
          }}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Add plot
        </button>
      </div>

      {panelMode !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            <PlotAddEditPanel
              key={panelPlot?.id ?? 'new'}
              mode={panelMode}
              projectId={projectId}
              plot={panelMode === 'edit' ? panelPlot ?? undefined : undefined}
              onClose={closePanel}
              onRefresh={onRefresh}
              onError={onError}
              className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Plot #</th>
              <th className="px-4 py-3">W × L (ft)</th>
              <th className="px-4 py-3">Sq ft</th>
              <th className="max-w-[140px] px-4 py-3">Details</th>
              <th className="px-4 py-3">Posted $/ft</th>
              <th className="px-4 py-3">Posted total</th>
              <th className="px-4 py-3">Final $/ft</th>
              <th className="px-4 py-3">Final total</th>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3">Curr.</th>
              <th className="px-4 py-3">Public</th>
              <th className="px-4 py-3">Res.</th>
              <th className="max-w-[100px] px-4 py-3">Notes</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {plots.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-slate-500">
                  No plots yet. Add one to track this land.
                </td>
              </tr>
            ) : (
              plots.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {p.plotNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-800">
                    {p.widthFeet} × {p.lengthFeet}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {sqFt(p).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td
                    className="max-w-[140px] truncate px-4 py-3 text-slate-600"
                    title={p.plotDetails}
                  >
                    {trunc(p.plotDetails, 48)}
                  </td>
                  <td className="px-4 py-3">{formatMoney(p.pricePerSqft, p.currency)}</td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(p.totalPurchasePrice, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {p.finalPricePerSqft != null
                      ? formatMoney(p.finalPricePerSqft, p.currency)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {p.finalTotalPurchasePrice != null
                      ? formatMoney(p.finalTotalPurchasePrice, p.currency)
                      : '—'}
                  </td>
                  <td className="max-w-[120px] truncate px-4 py-3 text-slate-600" title={p.purchaseParty}>
                    {trunc(p.purchaseParty, 24)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.currency}</td>
                  <td className="px-4 py-3">
                    {p.isPublicUse ? (
                      <span className="text-xs font-medium text-sky-800">Yes</span>
                    ) : (
                      <span className="text-slate-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.isReserved ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        Yes
                      </span>
                    ) : (
                      <span className="text-slate-500">No</span>
                    )}
                  </td>
                  <td
                    className="max-w-[100px] truncate px-4 py-3 text-slate-600"
                    title={p.notes}
                  >
                    {trunc(p.notes, 32)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{plotStatusLabel(p.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        className="text-xs text-teal-700 hover:underline"
                        onClick={() => {
                          setPanelPlot(p)
                          setPanelMode('edit')
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          if (!confirm('Delete this plot?')) return
                          void (async () => {
                            try {
                              await api.deletePlot(p.id, projectId)
                              await onRefresh()
                            } catch (err) {
                              onError(err instanceof Error ? err.message : 'Delete failed.')
                            }
                          })()
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
