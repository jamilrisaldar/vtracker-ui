import { useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { LandPlot, PlotStatus } from '../../types'
import { MoneyInrShorthand } from '../MoneyInrShorthand'
import {
  plotDimensionsLabel,
  plotEffectiveSqFt,
  plotProjectedSaleAmount,
  plotSoldRevenueAmount,
} from '../../utils/landPlotDisplay'
import { PlotAddEditPanel } from '../PlotAddEditPanel'
import { CombinePlotsSalePanel } from './CombinePlotsSalePanel'
import { PlotTransactionsView } from './PlotTransactionsView'
import {
  plotStatusLabel,
  plotTableRowClassName,
  plotTableStickyActionsCellClassName,
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

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function IconCircleMinus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  )
}

function IconBookmarkFilled({ className }: { className?: string }) {
  return (
    <svg className={className} width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
    </svg>
  )
}

function IconBookmarkOutline({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
    </svg>
  )
}

function IconSale({ className }: { className?: string }) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  )
}

const iconBtnBase =
  'inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 disabled:opacity-50'

/** Sold first, then pipeline toward open (matches typical reporting order). */
const PLOT_STATUS_SUMMARY_ORDER: PlotStatus[] = [
  'sold',
  'conditional_sale',
  'negotiating',
  'open',
]

function plotAmountKindLabel(status: PlotStatus): string {
  if (status === 'sold') return 'Revenue'
  if (status === 'open') return 'Posted / projected total'
  return 'Projected total'
}

export function PlotsTab({
  projectId,
  plots,
  onRefresh,
  onError,
  readOnly = false,
}: {
  projectId: string
  plots: LandPlot[]
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  readOnly?: boolean
}) {
  const [panelMode, setPanelMode] = useState<'add' | 'edit' | null>(null)
  const [panelPlot, setPanelPlot] = useState<LandPlot | null>(null)
  const [transactionsPlot, setTransactionsPlot] = useState<LandPlot | null>(null)
  const [copyFromPlot, setCopyFromPlot] = useState<LandPlot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LandPlot | null>(null)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [combinePanel, setCombinePanel] = useState<
    null | 'create' | { editGroupId: string }
  >(null)

  const openCombinedSaleEditor = (groupId: string) => {
    setCombinePanel({ editGroupId: groupId })
  }

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

  const plotStatusSummary = useMemo(() => {
    return PLOT_STATUS_SUMMARY_ORDER.map((status) => {
      const group = plots.filter((p) => p.status === status)
      const count = group.length
      if (count === 0) return null
      const getAmt = status === 'sold' ? plotSoldRevenueAmount : plotProjectedSaleAmount
      const byCurrency = new Map<string, number>()
      let unpriced = 0
      for (const p of group) {
        const a = getAmt(p)
        if (a == null || !Number.isFinite(a)) unpriced += 1
        else {
          const c = (p.currency ?? 'INR').trim() || 'INR'
          byCurrency.set(c, (byCurrency.get(c) ?? 0) + a)
        }
      }
      return {
        status,
        count,
        byCurrency,
        unpriced,
        statusLabel: plotStatusLabel(status),
        amountLabel: plotAmountKindLabel(status),
      }
    }).filter(
      (row): row is NonNullable<typeof row> => row != null,
    )
  }, [plots])

  return (
    <div className="space-y-6">
      {readOnly ? (
        <p className="text-xs text-amber-800/90">View-only: plot changes are disabled.</p>
      ) : null}
      {transactionsPlot ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setTransactionsPlot(null)}
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            ← Back to plots
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-900">Land plots</h2>
            <p className="mt-1 text-sm text-slate-600">
              Track dimensions (feet), area (regular or irregular four sides), pricing, and sale status.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-violet-900">Combined sale:</span> when one buyer takes several
              plots together, use <strong>Combine plots for sale</strong> so they share a single payment
              history. Those rows show a violet badge in the table.
            </p>
          </div>
          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
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
              <button
                type="button"
                onClick={() => setCombinePanel('create')}
                className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100"
              >
                Combine plots for sale
              </button>
            </div>
          ) : null}
        </div>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[60] bg-slate-900/40" role="dialog" aria-modal="true" aria-labelledby="delete-plot-title">
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md">
            <div className="flex h-full w-full flex-col border-l border-slate-200 bg-white p-6 shadow-xl">
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
              <div className="mt-auto flex flex-wrap justify-end gap-2 pt-8">
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
        </div>
      ) : null}

      {combinePanel ? (
        <div className="fixed inset-0 z-[56] bg-slate-900/40">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            <CombinePlotsSalePanel
              projectId={projectId}
              plots={plots}
              mode={combinePanel === 'create' ? 'create' : { editGroupId: combinePanel.editGroupId }}
              readOnly={readOnly}
              onClose={() => setCombinePanel(null)}
              onRefresh={onRefresh}
              onError={onError}
              className="h-full overflow-y-auto p-6 shadow-xl"
            />
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
        {transactionsPlot ? (
          <div className="relative p-4 md:p-6">
            <PlotTransactionsView
              projectId={projectId}
              plot={transactionsPlot}
              projectPlots={plots}
              readOnly={readOnly}
              showBackButton={false}
              onBack={() => setTransactionsPlot(null)}
              onError={onError}
              onProjectRefresh={onRefresh}
              onEditCombinedSale={readOnly ? undefined : openCombinedSaleEditor}
            />
          </div>
        ) : (
          <>
        <div className="max-h-[min(70vh,28rem)] overflow-auto overscroll-contain">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th
                  className="sticky top-0 left-0 z-[6] w-[7.75rem] min-w-[7.75rem] max-w-[7.75rem] whitespace-nowrap border-b border-r border-slate-200/90 bg-slate-50 px-2 py-3 text-left shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)]"
                  scope="col"
                >
                  <span className="sr-only">Actions</span>
                </th>
                <th className="sticky top-0 left-[7.75rem] z-[5] min-w-[7rem] border-b border-r border-slate-200/90 bg-slate-50 px-4 py-3 text-left shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)]">
                  Plot #
                </th>
                <th className="sticky top-0 z-[2] min-w-[10rem] max-w-[14rem] border-b border-slate-200 bg-slate-50 px-3 py-3 text-left">
                  Sale bundle
                </th>
                <th className="sticky top-0 z-[2] min-w-[17rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left">
                  W × L (ft)
                </th>
                <th className="sticky top-0 z-[2] min-w-[6rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-right tabular-nums">
                  Sq ft
                </th>
                <th className="sticky top-0 z-[2] min-w-[22rem] max-w-[32rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left">
                  Details
                </th>
                <th className="sticky top-0 z-[2] min-w-[7.5rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-right tabular-nums">
                  Posted $/ft
                </th>
                <th className="sticky top-0 z-[2] min-w-[8rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-right tabular-nums">
                  Posted total
                </th>
                <th className="sticky top-0 z-[2] min-w-[7.5rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-right tabular-nums">
                  Final $/ft
                </th>
                <th className="sticky top-0 z-[2] min-w-[8rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-right tabular-nums">
                  Final total
                </th>
                <th className="sticky top-0 z-[2] min-w-[8rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left">
                  Party
                </th>
                <th className="sticky top-0 z-[2] w-[3.25rem] min-w-[3.25rem] border-b border-slate-200 bg-slate-50 px-2 py-3 text-center">
                  Curr.
                </th>
                <th className="sticky top-0 z-[2] w-14 min-w-[3.5rem] border-b border-slate-200 bg-slate-50 px-2 py-3 text-center">
                  Public
                </th>
                <th className="sticky top-0 z-[2] w-14 min-w-[3.5rem] border-b border-slate-200 bg-slate-50 px-2 py-3 text-center">
                  Res.
                </th>
                <th className="sticky top-0 z-[2] min-w-[9rem] max-w-[14rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left">
                  Notes
                </th>
                <th className="sticky top-0 z-[2] min-w-[7rem] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left">
                  Status
                </th>
                <th className="sticky top-0 z-[2] w-11 min-w-[2.75rem] max-w-[2.75rem] border-b border-slate-200 bg-slate-50 px-2 py-3">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
            {plots.length === 0 ? (
              <tr>
                <td colSpan={17} className="px-4 py-8 text-center text-slate-500">
                  No plots yet. Add one to track this land.
                </td>
              </tr>
            ) : (
              plots.map((p) => {
                const sqFt = plotEffectiveSqFt(p)
                return (
                  <tr key={p.id} className={plotTableRowClassName(p)}>
                    <td className={plotTableStickyActionsCellClassName()}>
                      <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1">
                        <button
                          type="button"
                          disabled={readOnly}
                          className={`${iconBtnBase} shrink-0 text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
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
                          className={`${iconBtnBase} shrink-0 text-violet-700 hover:border-violet-200 hover:bg-violet-50`}
                          aria-label="Plot sale and buyer payments"
                          title="Sale & payments"
                          onClick={() => {
                            setTransactionsPlot(p)
                          }}
                        >
                          <IconSale className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={readOnly}
                          className={`${iconBtnBase} shrink-0 text-slate-600 hover:bg-slate-100`}
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
                      </div>
                    </td>
                    <td className={plotTableStickyPlotNumberCellClassName(p)}>
                      {p.plotNumber ?? '—'}
                    </td>
                    <td className="min-w-[10rem] max-w-[14rem] px-3 py-3 align-top">
                      {p.combinedSale ? (
                        <button
                          type="button"
                          disabled={readOnly}
                          title={
                            p.combinedSale.plotNumbersSummary
                              ? `Together: ${p.combinedSale.plotNumbersSummary}`
                              : `${p.combinedSale.plotCount} plots in one sale`
                          }
                          onClick={() => openCombinedSaleEditor(p.combinedSale!.groupId)}
                          className="inline-flex max-w-full flex-col items-start rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-left text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:cursor-default disabled:opacity-60"
                        >
                          <span className="truncate">Combined · {p.combinedSale.plotCount} plots</span>
                          {p.combinedSale.displayName.trim() ? (
                            <span className="w-full truncate font-normal text-violet-800/90">
                              {p.combinedSale.displayName.trim()}
                            </span>
                          ) : null}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="min-w-[17rem] whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-800 align-top">
                      {plotDimensionsLabel(p)}
                    </td>
                    <td className="min-w-[6rem] px-4 py-3 text-right align-top tabular-nums text-slate-600">
                      {sqFt != null && sqFt > 0
                        ? sqFt.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : '—'}
                    </td>
                    <td className="min-w-[22rem] max-w-[32rem] whitespace-normal break-words px-4 py-3 text-slate-600 align-top">
                      {p.plotDetails?.trim() ? p.plotDetails : '—'}
                    </td>
                    <td className="min-w-[7.5rem] px-4 py-3 text-right tabular-nums">
                      <MoneyInrShorthand
                        amount={p.pricePerSqft}
                        currency={p.currency}
                        className="tabular-nums"
                      />
                    </td>
                    <td className="min-w-[8rem] px-4 py-3 text-right font-medium tabular-nums">
                      {p.totalPurchasePrice != null ? (
                        <MoneyInrShorthand
                          amount={p.totalPurchasePrice}
                          currency={p.currency}
                          className="font-medium tabular-nums"
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="min-w-[7.5rem] px-4 py-3 text-right tabular-nums text-slate-700">
                      {p.finalPricePerSqft != null ? (
                        <MoneyInrShorthand
                          amount={p.finalPricePerSqft}
                          currency={p.currency}
                          className="tabular-nums text-slate-700"
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="min-w-[8rem] px-4 py-3 text-right tabular-nums text-slate-700">
                      {p.finalTotalPurchasePrice != null ? (
                        <MoneyInrShorthand
                          amount={p.finalTotalPurchasePrice}
                          currency={p.currency}
                          className="tabular-nums text-slate-700"
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="min-w-[8rem] max-w-[12rem] truncate px-4 py-3 text-slate-600" title={p.purchaseParty}>
                      {trunc(p.purchaseParty, 24)}
                    </td>
                    <td className="w-[3.25rem] min-w-[3.25rem] px-2 py-3 text-center text-slate-600">
                      {p.currency}
                    </td>
                    <td className="w-14 min-w-[3.5rem] px-2 py-3 align-middle">
                      <div className="flex justify-center" title={p.isPublicUse ? 'Public use' : 'Not public use'}>
                        <span className="sr-only">{p.isPublicUse ? 'Public use: yes' : 'Public use: no'}</span>
                        {p.isPublicUse ? (
                          <IconCheckCircle className="text-sky-600" />
                        ) : (
                          <IconCircleMinus className="text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="w-14 min-w-[3.5rem] px-2 py-3 align-middle">
                      <div className="flex justify-center" title={p.isReserved ? 'Reserved' : 'Not reserved'}>
                        <span className="sr-only">{p.isReserved ? 'Reserved: yes' : 'Reserved: no'}</span>
                        {p.isReserved ? (
                          <IconBookmarkFilled className="text-amber-600" />
                        ) : (
                          <IconBookmarkOutline className="text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td
                      className="min-w-[9rem] max-w-[14rem] truncate px-4 py-3 text-slate-600"
                      title={p.notes}
                    >
                      {trunc(p.notes, 32)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{plotStatusLabel(p.status)}</td>
                    <td className="w-11 min-w-[2.75rem] max-w-[2.75rem] whitespace-nowrap px-2 py-3 text-center">
                      <button
                        type="button"
                        disabled={readOnly}
                        className={`${iconBtnBase} mx-auto text-red-600 hover:border-red-200 hover:bg-red-50`}
                        aria-label="Delete plot"
                        title="Delete"
                        onClick={() => {
                          setDeleteConfirmInput('')
                          setDeleteTarget(p)
                        }}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
            </tbody>
          </table>
        </div>

        {plots.length > 0 ? (
          <div className="border-t border-slate-200 bg-slate-50/90 px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Summary by status</h3>
            <p className="mt-1 text-xs text-slate-500">
              Totals use final/posted amounts when set; otherwise price per sq ft × square feet. Mixed
              currencies are shown separately.
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-800">
              {plotStatusSummary.map((row) => (
                <li key={row.status} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium text-slate-900">
                    {row.count} plot{row.count === 1 ? '' : 's'} ({row.statusLabel})
                  </span>
                  <span className="text-slate-500">—</span>
                  <span className="text-slate-600">{row.amountLabel}:</span>
                  {row.byCurrency.size === 0 ? (
                    <span className="text-slate-500">no priced plots</span>
                  ) : (
                    <span className="text-right font-medium">
                      {[...row.byCurrency.entries()].map(([cur, sum], i) => (
                        <span key={cur}>
                          {i > 0 ? <span className="text-slate-400"> · </span> : null}
                          <MoneyInrShorthand
                            amount={sum}
                            currency={cur}
                            className="tabular-nums"
                          />
                        </span>
                      ))}
                    </span>
                  )}
                  {row.unpriced > 0 ? (
                    <span className="w-full text-xs text-slate-500 sm:w-auto sm:pl-1">
                      ({row.unpriced} without usable price data)
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
          </>
        )}
      </div>
    </div>
  )
}
