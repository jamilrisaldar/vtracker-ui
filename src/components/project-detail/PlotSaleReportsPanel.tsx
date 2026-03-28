import { useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { PlotSaleReportKind, PlotSaleReportResponse } from '../../types'
import {
  exportPlotSaleReportExcel,
  exportPlotSaleReportPdf,
  plotSaleReportIsAmountColumn,
  plotSaleReportPreviewRows,
} from '../../utils/exportPlotSaleReport'

function defaultDateRange(): { start: string; end: string } {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return { start: `${y}-01-01`, end: `${y}-${m}-${d}` }
}

export function PlotSaleReportsPanel({
  projectId,
  projectName,
  onClose,
  onError,
}: {
  projectId: string
  projectName: string
  onClose: () => void
  onError: (msg: string | null) => void
}) {
  const initialRange = useMemo(() => defaultDateRange(), [])
  const [startDate, setStartDate] = useState(initialRange.start)
  const [endDate, setEndDate] = useState(initialRange.end)
  const [reportKind, setReportKind] = useState<PlotSaleReportKind>('fiscal')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PlotSaleReportResponse | null>(null)

  const preview = useMemo(() => (data ? plotSaleReportPreviewRows(data) : null), [data])

  const runReport = async () => {
    onError(null)
    setLoading(true)
    try {
      const res = await api.getPlotSaleReport(projectId, {
        report: reportKind,
        startDate,
        endDate,
      })
      setData(res)
    } catch (e) {
      setData(null)
      onError(e instanceof Error ? e.message : 'Report failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[58] flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plot-sale-reports-title"
    >
      <div className="flex max-h-[min(90vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="plot-sale-reports-title" className="text-lg font-semibold text-slate-900">
              Plot sale reports
            </h2>
            <p className="mt-1 text-sm text-slate-600">{projectName}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Start date</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">End date</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-medium text-slate-600">Report type</legend>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="plot-sale-report-kind"
                  className="mt-1"
                  checked={reportKind === 'fiscal'}
                  onChange={() => {
                    setReportKind('fiscal')
                    setData(null)
                  }}
                />
                <span>
                  <span className="font-medium text-slate-800">Fiscal (tax filing)</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Sold single-plot and combined sales (one row per combined purchase) with
                    subregistrar registration in the range. Payments: all-time net by mode (refunds
                    subtract).
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="plot-sale-report-kind"
                  className="mt-1"
                  checked={reportKind === 'activity'}
                  onChange={() => {
                    setReportKind('activity')
                    setData(null)
                  }}
                />
                <span>
                  <span className="font-medium text-slate-800">Activity</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Single-plot and combined sales with buyer payments in the range (one row per
                    combined purchase). Totals by mode for that window only.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void runReport()}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? 'Running…' : 'Run report'}
            </button>
            {data && data.rows.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => exportPlotSaleReportExcel(projectName, data)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => exportPlotSaleReportPdf(projectName, data)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Export PDF
                </button>
              </>
            ) : null}
          </div>

          {data ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs leading-relaxed text-slate-600">{data.note}</p>
              {data.rows.length === 0 ? (
                <p className="text-sm text-slate-500">No rows for this range.</p>
              ) : preview ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {preview.headers.map((h, ci) => (
                          <th
                            key={ci}
                            className={[
                              'whitespace-nowrap px-2 py-2 font-medium',
                              plotSaleReportIsAmountColumn(ci, preview.headers.length)
                                ? 'text-right'
                                : 'text-left',
                            ].join(' ')}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.map((row, ri) => (
                        <tr key={ri} className="tabular-nums">
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className={[
                                'max-w-[14rem] truncate px-2 py-1.5 text-slate-800',
                                plotSaleReportIsAmountColumn(ci, preview.headers.length)
                                  ? 'text-right'
                                  : 'text-left',
                              ].join(' ')}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {preview.grandTotalRows.map((row, ri) => (
                        <tr
                          key={`gt-${ri}`}
                          className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900 tabular-nums"
                        >
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className={[
                                'max-w-[14rem] truncate px-2 py-2',
                                plotSaleReportIsAmountColumn(ci, preview.headers.length)
                                  ? 'text-right'
                                  : 'text-left',
                              ].join(' ')}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
