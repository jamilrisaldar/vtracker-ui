import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/dataApi'
import type { Phase, PhaseStatus } from '../types'
import { phaseStatusOptions } from './project-detail/constants'

type PhasePanelMode = 'add' | 'edit'

function optionalMoney(raw: string): number | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) throw new Error('Amounts must be non-negative numbers.')
  return n
}

function nullableMoney(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) throw new Error('Amounts must be non-negative numbers.')
  return n
}

export function PhaseAddEditPanel({
  mode,
  projectId,
  phase,
  onClose,
  onRefresh,
  onError,
  disabled,
  className,
  defaultStartDate,
}: {
  mode: PhasePanelMode
  projectId: string
  phase?: Phase
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  disabled?: boolean
  className?: string
  defaultStartDate?: string
}) {
  function addDaysToIsoDate(dateStr: string, days: number): string {
    const base = new Date(`${dateStr}T00:00:00Z`)
    if (Number.isNaN(base.getTime())) return dateStr
    base.setUTCDate(base.getUTCDate() + days)
    return base.toISOString().slice(0, 10)
  }

  const initial = useMemo(() => {
    if (mode === 'edit' && phase) {
      return {
        name: phase.name,
        startDate: phase.startDate,
        endDate: phase.endDate,
        notes: phase.notes ?? '',
        status: phase.status,
        estimatedStr:
          phase.estimatedTotal != null && Number.isFinite(phase.estimatedTotal)
            ? String(phase.estimatedTotal)
            : '',
        actualStr:
          phase.actualSpend != null && Number.isFinite(phase.actualSpend)
            ? String(phase.actualSpend)
            : '',
      }
    }
    return {
      name: '',
      startDate: defaultStartDate ?? '',
      endDate: '',
      notes: '',
      status: 'not_started' as PhaseStatus,
      estimatedStr: '',
      actualStr: '',
    }
  }, [mode, phase, defaultStartDate])

  const [name, setName] = useState(initial.name)
  const [start, setStart] = useState(initial.startDate)
  const [end, setEnd] = useState(initial.endDate)
  const [notes, setNotes] = useState(initial.notes)
  const [status, setStatus] = useState<PhaseStatus>(initial.status)
  const [estimatedStr, setEstimatedStr] = useState(initial.estimatedStr)
  const [actualStr, setActualStr] = useState(initial.actualStr)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(initial.name)
    setStart(initial.startDate)
    setEnd(initial.endDate)
    setNotes(initial.notes)
    setStatus(initial.status)
    setEstimatedStr(initial.estimatedStr)
    setActualStr(initial.actualStr)
  }, [initial])

  const title = mode === 'add' ? 'Add phase / task' : 'Edit phase / task'

  async function handleSave(closeAfterSave: boolean) {
    if (!name.trim() || !start || !end) return
    onError(null)
    let estimatedTotal: number | undefined
    let actualSpend: number | undefined
    let estimatedPatch: number | null | undefined
    let actualPatch: number | null | undefined
    try {
      if (mode === 'add') {
        estimatedTotal = optionalMoney(estimatedStr)
        actualSpend = optionalMoney(actualStr)
      } else {
        estimatedPatch = nullableMoney(estimatedStr)
        actualPatch = nullableMoney(actualStr)
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Invalid amount.')
      return
    }

    setSaving(true)
    try {
      let created: Phase | undefined

      if (mode === 'add') {
        created = await api.createPhase({
          projectId,
          name,
          notes: notes.trim() || undefined,
          startDate: start,
          endDate: end,
          status,
          estimatedTotal,
          actualSpend,
        })
      } else {
        if (!phase) throw new Error('Missing phase to edit.')
        await api.updatePhase(
          phase.id,
          {
            name,
            notes: notes.trim() || null,
            startDate: start,
            endDate: end,
            status,
            estimatedTotal: estimatedPatch,
            actualSpend: actualPatch,
          },
          projectId,
        )
      }

      await onRefresh()

      if (mode === 'add' && !closeAfterSave) {
        setName('')
        setStart(created?.endDate ? addDaysToIsoDate(created.endDate, 1) : '')
        setEnd('')
        setNotes('')
        setStatus('not_started')
        setEstimatedStr('')
        setActualStr('')
      } else {
        onClose()
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save phase.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={['rounded-none border border-slate-200 bg-white p-6 shadow-sm', className]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="text-lg font-medium text-slate-900">{title}</h2>

      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          await handleSave(true)
        }}
      >
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Name</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Foundation & substructure"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Start</span>
          <input
            required
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">End</span>
          <input
            required
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Status</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as PhaseStatus)}
          >
            {phaseStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Total estimate (optional)</span>
          <input
            type="text"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={estimatedStr}
            onChange={(e) => setEstimatedStr(e.target.value)}
            placeholder="e.g. 150000"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Actual spend (optional)</span>
          <input
            type="text"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={actualStr}
            onChange={(e) => setActualStr(e.target.value)}
            placeholder="e.g. 142000"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Notes (optional)</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="mt-1 flex gap-2 sm:col-span-2">
          {mode === 'add' ? (
            <>
              <button
                type="button"
                disabled={saving || disabled}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                onClick={() => void handleSave(false)}
              >
                {saving ? 'Saving…' : 'Add phase'}
              </button>
              <button
                type="submit"
                disabled={saving || disabled}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Add phase and close'}
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={saving || disabled}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={() => onClose()}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
