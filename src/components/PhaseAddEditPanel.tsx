import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/dataApi'
import type { Phase } from '../types'

type PhasePanelMode = 'add' | 'edit'

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
    // Treat incoming YYYY-MM-DD as UTC to avoid TZ drift.
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
        description: phase.description ?? '',
      }
    }
    return {
      name: '',
      startDate: defaultStartDate ?? '',
      endDate: '',
      description: '',
    }
  }, [mode, phase, defaultStartDate])

  const [name, setName] = useState(initial.name)
  const [start, setStart] = useState(initial.startDate)
  const [end, setEnd] = useState(initial.endDate)
  const [desc, setDesc] = useState(initial.description)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(initial.name)
    setStart(initial.startDate)
    setEnd(initial.endDate)
    setDesc(initial.description)
  }, [initial])

  const title = mode === 'add' ? 'Add phase / task' : 'Edit phase / task'
  async function handleSave(closeAfterSave: boolean) {
    if (!name.trim() || !start || !end) return
    onError(null)
    setSaving(true)
    try {
      let created: Phase | undefined

      if (mode === 'add') {
        created = await api.createPhase({
          projectId,
          name,
          description: desc || undefined,
          startDate: start,
          endDate: end,
        })
      } else {
        if (!phase) throw new Error('Missing phase to edit.')
        await api.updatePhase(
          phase.id,
          {
            name,
            description: desc || undefined,
            startDate: start,
            endDate: end,
          },
          projectId,
        )
      }

      await onRefresh()

      if (mode === 'add' && !closeAfterSave) {
        setName('')
        setStart(created?.endDate ? addDaysToIsoDate(created.endDate, 1) : '')
        setEnd('')
        setDesc('')
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
    <div className={['rounded-none border border-slate-200 bg-white p-6 shadow-sm', className].filter(Boolean).join(' ')}>
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
          <span className="text-xs font-medium text-slate-600">
            Notes (optional)
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </label>

        <div className="sm:col-span-2 mt-1 flex gap-2">
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

