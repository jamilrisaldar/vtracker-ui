import { useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Phase, PhaseStatus } from '../../types'
import { formatDate, formatMoney } from '../../utils/format'
import { phaseStatusOptions, phaseTableRowClassName } from './constants'

const iconBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

function toIsoLocal(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function defaultCalendarMonthRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: toIsoLocal(start), end: toIsoLocal(end) }
}

function addDaysLocal(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  d.setDate(d.getDate() + days)
  return toIsoLocal(d)
}

/** Inclusive length in days between two YYYY-MM-DD dates (local). */
function rangeInclusiveDays(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime()
  const b = new Date(`${end}T12:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 1
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

/** Phase [start,end] overlaps [rangeStart, rangeEnd] (inclusive). */
function phaseOverlapsRange(
  phase: Pick<Phase, 'startDate' | 'endDate'>,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return phase.startDate <= rangeEnd && phase.endDate >= rangeStart
}

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

const COLUMN_META: { status: PhaseStatus; title: string; columnClass: string }[] = [
  { status: 'not_started', title: 'Not started', columnClass: 'border-slate-200 bg-slate-50/80' },
  { status: 'in_progress', title: 'In progress', columnClass: 'border-sky-200 bg-sky-50/50' },
  { status: 'done', title: 'Done', columnClass: 'border-emerald-200 bg-emerald-50/50' },
]

export function PhasesKanbanBoard({
  projectId,
  phases,
  onRefresh,
  onError,
  onEdit,
  onRequestDelete,
  actionsDisabled,
  readOnly = false,
}: {
  projectId: string
  phases: Phase[]
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  onEdit: (phase: Phase) => void
  onRequestDelete: (phase: Phase) => void
  actionsDisabled: boolean
  readOnly?: boolean
}) {
  const disabled = actionsDisabled || readOnly
  const initialRange = useMemo(() => defaultCalendarMonthRange(), [])
  const [rangeStart, setRangeStart] = useState(initialRange.start)
  const [rangeEnd, setRangeEnd] = useState(initialRange.end)

  const filtered = useMemo(
    () => phases.filter((p) => phaseOverlapsRange(p, rangeStart, rangeEnd)),
    [phases, rangeStart, rangeEnd],
  )

  const byStatus = useMemo(() => {
    const map: Record<PhaseStatus, Phase[]> = {
      not_started: [],
      in_progress: [],
      done: [],
    }
    for (const p of filtered) {
      map[p.status].push(p)
    }
    for (const k of Object.keys(map) as PhaseStatus[]) {
      map[k].sort(
        (a, b) =>
          a.displayOrder - b.displayOrder || a.startDate.localeCompare(b.startDate),
      )
    }
    return map
  }, [filtered])

  const stepDays = rangeInclusiveDays(rangeStart, rangeEnd)

  function shiftWindow(direction: -1 | 1) {
    const delta = direction * stepDays
    setRangeStart((s) => addDaysLocal(s, delta))
    setRangeEnd((e) => addDaysLocal(e, delta))
  }

  function applyPreset(kind: 'month' | '30d' | '7d') {
    const today = new Date()
    if (kind === 'month') {
      const { start, end } = defaultCalendarMonthRange()
      setRangeStart(start)
      setRangeEnd(end)
      return
    }
    const days = kind === '30d' ? 30 : 7
    const start = toIsoLocal(today)
    const end = addDaysLocal(start, days - 1)
    setRangeStart(start)
    setRangeEnd(end)
  }

  const moneyDash = '—'

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">From</span>
            <input
              type="date"
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={rangeStart}
              onChange={(e) => {
                const v = e.target.value
                setRangeStart(v)
                if (v > rangeEnd) setRangeEnd(v)
              }}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">To</span>
            <input
              type="date"
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={rangeEnd}
              onChange={(e) => {
                const v = e.target.value
                setRangeEnd(v)
                if (v < rangeStart) setRangeStart(v)
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Presets:</span>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => applyPreset('month')}
          >
            This month
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => applyPreset('30d')}
          >
            Next 30 days
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => applyPreset('7d')}
          >
            Next 7 days
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => shiftWindow(-1)}
            aria-label="Shift date range earlier"
          >
            ◀ Earlier
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => shiftWindow(1)}
            aria-label="Shift date range later"
          >
            Later ▶
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Showing phases whose dates overlap{' '}
        <span className="font-medium text-slate-700">
          {formatDate(rangeStart)} – {formatDate(rangeEnd)}
        </span>{' '}
        ({filtered.length} of {phases.length}).
      </p>

      <div className="grid min-h-[12rem] grid-cols-1 gap-3 md:grid-cols-3">
        {COLUMN_META.map((col) => (
          <div
            key={col.status}
            className={`flex min-h-0 flex-col rounded-xl border ${col.columnClass}`}
          >
            <div className="border-b border-slate-200/80 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-800">{col.title}</h3>
              <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                {byStatus[col.status].length} in range
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
              {byStatus[col.status].length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-white/60 px-2 py-6 text-center text-xs text-slate-500">
                  No phases in this period.
                </p>
              ) : (
                byStatus[col.status].map((phase) => (
                  <article
                    key={phase.id}
                    className={`rounded-lg border border-slate-200/90 p-2.5 shadow-sm ${phaseTableRowClassName(phase.status)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 font-medium leading-snug text-slate-900">
                        {phase.name}
                      </p>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          title="Edit"
                          aria-label="Edit phase"
                          disabled={disabled}
                          className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                          onClick={() => onEdit(phase)}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          aria-label="Delete phase"
                          disabled={disabled}
                          className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
                          onClick={() => onRequestDelete(phase)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {formatDate(phase.startDate)} – {formatDate(phase.endDate)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span>
                        Est.:{' '}
                        {phase.estimatedTotal != null && Number.isFinite(phase.estimatedTotal)
                          ? formatMoney(phase.estimatedTotal)
                          : moneyDash}
                      </span>
                      <span>
                        Actual:{' '}
                        {phase.actualSpend != null && Number.isFinite(phase.actualSpend)
                          ? formatMoney(phase.actualSpend)
                          : moneyDash}
                      </span>
                    </div>
                    <div className="mt-2">
                      <select
                        className="w-full rounded border border-slate-200 bg-white/90 px-1.5 py-1 text-xs"
                        value={phase.status}
                        disabled={disabled}
                        onChange={(e) => {
                          const v = e.target.value as PhaseStatus
                          void (async () => {
                            try {
                              await api.updatePhase(phase.id, { status: v }, projectId)
                              await onRefresh()
                            } catch (err) {
                              onError(err instanceof Error ? err.message : 'Update failed.')
                            }
                          })()
                        }}
                      >
                        {phaseStatusOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
