import { useState } from 'react'
import * as api from '../../api/dataApi'
import type { LandPlot } from '../../types'
import { formatMoneyInrShorthand } from '../../utils/format'
import { plotDimensionsLabel, plotEffectiveSqFt } from '../../utils/landPlotDisplay'
import { PlotAddEditPanel } from '../PlotAddEditPanel'
import {
  plotStatusLabel,
  plotTableRowClassName,
  plotTableStickyPlotNumberCellClassName,
} from './constants'

/** Shown in table when plot number is missing; user types this to confirm delete. */
const DELETE_CONFIRM_NO_PLOT_NUMBER = 'NO PLOT NUMBER'

function deleteConfirmationExpected(plot: LandPlot): string {
  const n = plot.plotNumber?.trim()
  if (n) return n
  return DELETE_CONFIRM_NO_PLOT_NUMBER
}

function trunc(s: string | undefined, max: number): string {
  if (!s) return '—'
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x={9} y={9} width={13} height={13} rx={2} />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  )
}

const iconBtnBase =
  'inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 disabled:opacity-50'

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
  const [copyFromPlot, setCopyFromPlot] = useState<LandPlot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LandPlot | null>(null)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const closePanel = () => {
    setPanelMode(null)
    setPanelPlot(null)
    setCopyFromPlot(null)
  }

  const closeDeleteDialog = () => {
    setDeleteTarget(null)
    setDeleteConfirmInput('')
    setDeleteBusy(false)
  }

  const deleteExpected = deleteTarget ? deleteConfirmationExpected(deleteTarget) : ''
  const deleteCanSubmit =
    deleteTarget != null && deleteConfirmInput === deleteExpected && !deleteBusy

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Land plots</h2>
          <p className="mt-1 text-sm text-slate-600">
            Track dimensions (feet), area (regular or irregular W1×L1 + W2×L2), pricing, and sale status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCopyFromPlot(null)
            setPanelPlot(null)
            setPanelMode('add')
          }}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Add plot
        </button>
      </div>

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-plot-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-plot-title" className="text-lg font-medium text-slate-900">
              Delete plot
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This cannot be undone. Type the plot number exactly as shown in the table to confirm.
            </p>
            {deleteTarget.plotNumber?.trim() ? (
              <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900">
                {deleteTarget.plotNumber.trim()}
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                This plot has no plot number. Type{' '}
                <span className="font-mono font-medium text-slate-900">{DELETE_CONFIRM_NO_PLOT_NUMBER}</span>{' '}
                to confirm.
              </p>
            )}
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Confirmation</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={deleteExpected}
                autoComplete="off"
                autoFocus
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={closeDeleteDialog}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={!deleteCanSubmit}
                onClick={() => {
                  if (!deleteTarget || !deleteCanSubmit) return
                  setDeleteBusy(true)
                  void (async () => {
                    try {
                      await api.deletePlot(deleteTarget.id, projectId)
                      await onRefresh()
                      closeDeleteDialog()
                    } catch (err) {
                      onError(err instanceof Error ? err.message : 'Delete failed.')
                      setDeleteBusy(false)
                    }
                  })()
                }}
              >
                {deleteBusy ? 'Deleting…' : 'Delete plot'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {panelMode !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            <PlotAddEditPanel
              key={
                panelMode === 'edit' && panelPlot
                  ? `edit-${panelPlot.id}`
                  : copyFromPlot
                    ? `copy-${copyFromPlot.id}`
                    : 'add-new'
              }
              mode={panelMode}
              projectId={projectId}
              plot={panelMode === 'edit' ? panelPlot ?? undefined : undefined}
              copyFrom={panelMode === 'add' ? copyFromPlot ?? undefined : undefined}
              onClose={closePanel}
              onRefresh={onRefresh}
              onError={onError}
              className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
            />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[min(70vh,28rem)] overflow-auto overscroll-contain">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="sticky top-0 left-0 z-[5] border-b border-r border-slate-200/90 bg-slate-50 px-4 py-3 text-left shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)]">
                  Plot #
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  W × L (ft)
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Sq ft
                </th>
                <th className="sticky top-0 z-[2] min-w-[12rem] max-w-[20rem] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Details
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Posted $/ft
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Posted total
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Final $/ft
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Final total
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Party
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Curr.
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Public
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Res.
                </th>
                <th className="sticky top-0 z-[2] max-w-[100px] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Notes
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3">
                  Status
                </th>
                <th className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3" />
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
              plots.map((p) => {
                const sqFt = plotEffectiveSqFt(p)
                return (
                  <tr key={p.id} className={plotTableRowClassName(p)}>
                    <td className={plotTableStickyPlotNumberCellClassName(p)}>
                      {p.plotNumber ?? '—'}
                    </td>
                    <td className="whitespace-pre-line px-4 py-3 font-mono text-xs leading-snug text-slate-800 align-top">
                      {plotDimensionsLabel(p)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 align-top tabular-nums">
                      {sqFt != null && sqFt > 0
                        ? sqFt.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : '—'}
                    </td>
                    <td className="min-w-[12rem] max-w-[20rem] whitespace-normal break-words px-4 py-3 text-slate-600 align-top">
                      {p.plotDetails?.trim() ? p.plotDetails : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {formatMoneyInrShorthand(p.pricePerSqft, p.currency)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {p.totalPurchasePrice != null
                        ? formatMoneyInrShorthand(p.totalPurchasePrice, p.currency)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.finalPricePerSqft != null
                        ? formatMoneyInrShorthand(p.finalPricePerSqft, p.currency)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.finalTotalPurchasePrice != null
                        ? formatMoneyInrShorthand(p.finalTotalPurchasePrice, p.currency)
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
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          className={`${iconBtnBase} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                          aria-label="Edit plot"
                          title="Edit"
                          onClick={() => {
                            setCopyFromPlot(null)
                            setPanelPlot(p)
                            setPanelMode('edit')
                          }}
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={`${iconBtnBase} text-slate-600 hover:bg-slate-100`}
                          aria-label="Copy plot to new row"
                          title="Copy"
                          onClick={() => {
                            setPanelPlot(null)
                            setCopyFromPlot(p)
                            setPanelMode('add')
                          }}
                        >
                          <IconCopy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={`${iconBtnBase} text-red-600 hover:border-red-200 hover:bg-red-50`}
                          aria-label="Delete plot"
                          title="Delete"
                          onClick={() => {
                            setDeleteConfirmInput('')
                            setDeleteTarget(p)
                          }}
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
