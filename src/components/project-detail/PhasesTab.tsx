import { useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Phase, PhaseStatus } from '../../types'
import { formatDate } from '../../utils/format'
import { PhaseAddEditPanel } from '../PhaseAddEditPanel'
import { phaseStatusOptions } from './constants'

export function PhasesTab({
  projectId,
  phases,
  onRefresh,
  onError,
}: {
  projectId: string
  phases: Phase[]
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
}) {
  const [reordering, setReordering] = useState(false)
  const [panelMode, setPanelMode] = useState<'add' | 'edit' | null>(null)
  const [panelPhase, setPanelPhase] = useState<Phase | null>(null)

  const openAdd = () => {
    if (reordering) return
    setPanelPhase(null)
    setPanelMode('add')
  }

  const openEdit = (phase: Phase) => {
    if (reordering) return
    setPanelPhase(phase)
    setPanelMode('edit')
  }

  const closePanel = () => {
    setPanelMode(null)
    setPanelPhase(null)
  }

  const sortedPhases = useMemo(
    () =>
      [...phases].sort(
        (a, b) =>
          a.displayOrder - b.displayOrder ||
          a.startDate.localeCompare(b.startDate),
      ),
    [phases],
  )

  function addDaysToIsoDate(dateStr: string, days: number): string {
    const base = new Date(`${dateStr}T00:00:00Z`)
    if (Number.isNaN(base.getTime())) return dateStr
    base.setUTCDate(base.getUTCDate() + days)
    return base.toISOString().slice(0, 10)
  }

  const nextDefaultStartDate = useMemo(() => {
    if (sortedPhases.length === 0) return undefined
    const last = sortedPhases[sortedPhases.length - 1]
    if (!last.endDate) return undefined
    return addDaysToIsoDate(last.endDate, 1)
  }, [sortedPhases])

  const actionsDisabled = reordering || panelMode !== null

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={reordering}
          onClick={openAdd}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          Add phase
        </button>
      </div>

      {panelMode !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            <PhaseAddEditPanel
              mode={panelMode}
              projectId={projectId}
              phase={panelMode === 'edit' ? panelPhase ?? undefined : undefined}
              onClose={closePanel}
              onRefresh={onRefresh}
              onError={onError}
              disabled={reordering}
              defaultStartDate={panelMode === 'add' ? nextDefaultStartDate : undefined}
              className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-14 min-w-[3.5rem] max-w-[3.5rem] whitespace-nowrap px-2 py-3" scope="col">
                <span className="sr-only">Edit</span>
              </th>
              <th className="w-px whitespace-nowrap px-2 py-3" scope="col">
                Order
              </th>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Status</th>
              <th className="w-14 min-w-[3.5rem] max-w-[3.5rem] whitespace-nowrap px-2 py-3">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {phases.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No phases yet.
                </td>
              </tr>
            ) : (
              sortedPhases.map((ph) => (
                <PhaseRow
                  key={ph.id}
                  projectId={projectId}
                  phase={ph}
                  sortedPhases={sortedPhases}
                  reordering={reordering}
                  setReordering={setReordering}
                  onRefresh={onRefresh}
                  onError={onError}
                  onEdit={openEdit}
                  actionsDisabled={actionsDisabled}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PhaseRow({
  projectId,
  phase,
  sortedPhases,
  reordering,
  setReordering,
  onRefresh,
  onError,
  onEdit,
  actionsDisabled,
}: {
  projectId: string
  phase: Phase
  sortedPhases: Phase[]
  reordering: boolean
  setReordering: (v: boolean) => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  onEdit: (phase: Phase) => void
  actionsDisabled: boolean
}) {
  const rowIndex = sortedPhases.findIndex((p) => p.id === phase.id)
  const canMoveUp = rowIndex > 0
  const canMoveDown = rowIndex >= 0 && rowIndex < sortedPhases.length - 1

  async function movePhase(direction: 'up' | 'down') {
    if (rowIndex < 0) return
    const swapWith = direction === 'up' ? rowIndex - 1 : rowIndex + 1
    if (swapWith < 0 || swapWith >= sortedPhases.length) return
    const a = sortedPhases[rowIndex]
    const b = sortedPhases[swapWith]
    const aOrder = a.displayOrder
    const bOrder = b.displayOrder
    setReordering(true)
    onError(null)
    try {
      await api.updatePhase(a.id, { displayOrder: bOrder }, projectId)
      await api.updatePhase(b.id, { displayOrder: aOrder }, projectId)
      await onRefresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Reorder failed.')
    } finally {
      setReordering(false)
    }
  }

  return (
    <tr className="border-b border-slate-100">
      <td className="w-14 min-w-[3.5rem] max-w-[3.5rem] whitespace-nowrap px-2 py-3 align-middle">
        <button
          type="button"
          disabled={actionsDisabled}
          className="text-xs text-teal-700 hover:underline disabled:opacity-40"
          onClick={() => onEdit(phase)}
        >
          Edit
        </button>
      </td>
      <td className="px-2 py-2 align-middle">
        <div className="flex w-[2.25rem] shrink-0 flex-col flex-nowrap gap-0.5">
          <button
            type="button"
            title="Move up"
            disabled={!canMoveUp || reordering || actionsDisabled}
            onClick={() => void movePhase('up')}
            className="rounded border border-slate-200 bg-white p-0.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 5.293l-6 6 1.414 1.414L10 8.12l4.586 4.586L16 11.293l-6-6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            type="button"
            title="Move down"
            disabled={!canMoveDown || reordering || actionsDisabled}
            onClick={() => void movePhase('down')}
            className="rounded border border-slate-200 bg-white p-0.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 14.707l6-6-1.414-1.414L10 11.88 5.414 7.293 4 8.707l6 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </td>
      <td className="px-4 py-3 font-medium text-slate-900">{phase.name}</td>
      <td className="px-4 py-3 text-slate-600">{formatDate(phase.startDate)}</td>
      <td className="px-4 py-3 text-slate-600">{formatDate(phase.endDate)}</td>
      <td className="px-4 py-3">
        <select
          className="rounded border border-slate-200 px-2 py-1 text-xs"
          value={phase.status}
          disabled={reordering || actionsDisabled}
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
      </td>
      <td className="w-14 min-w-[3.5rem] max-w-[3.5rem] whitespace-nowrap px-2 py-3 align-middle">
        <button
          type="button"
          disabled={reordering || actionsDisabled}
          className="text-xs text-red-600 hover:underline disabled:opacity-40"
          onClick={() => {
            if (!confirm('Delete this phase?')) return
            void (async () => {
              try {
                await api.deletePhase(phase.id, projectId)
                await onRefresh()
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Delete failed.')
              }
            })()
          }}
        >
          Remove
        </button>
      </td>
    </tr>
  )
}
