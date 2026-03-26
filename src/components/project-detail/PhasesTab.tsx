import { useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Phase, PhaseStatus } from '../../types'
import { formatDate, formatMoney } from '../../utils/format'
import { PhaseAddEditPanel } from '../PhaseAddEditPanel'
import { phaseStatusOptions, phaseTableRowClassName } from './constants'

const iconBtnClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
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
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

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
  const [deleteTarget, setDeleteTarget] = useState<Phase | null>(null)
  const [deleteNameInput, setDeleteNameInput] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

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

  const openDeletePhase = (phase: Phase) => {
    if (reordering || panelMode !== null) return
    setDeleteTarget(phase)
    setDeleteNameInput('')
  }

  const closeDeletePhase = () => {
    setDeleteTarget(null)
    setDeleteNameInput('')
    setDeleteBusy(false)
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
  const deleteNameOk = deleteTarget != null && deleteNameInput === deleteTarget.name
  const deleteCanSubmit = deleteNameOk && !deleteBusy

  return (
    <div className="space-y-8">
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-phase-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-phase-title" className="text-lg font-medium text-slate-900">
              Delete phase / task
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove this phase and cannot be undone.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Type the phase name exactly as shown below to confirm:
            </p>
            <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-900">
              {deleteTarget.name}
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Phase name</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={deleteNameInput}
                onChange={(e) => setDeleteNameInput(e.target.value)}
                placeholder={deleteTarget.name}
                autoComplete="off"
                autoFocus
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={deleteBusy}
                onClick={closeDeletePhase}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={!deleteCanSubmit}
                onClick={() => {
                  if (!deleteCanSubmit) return
                  setDeleteBusy(true)
                  onError(null)
                  void (async () => {
                    try {
                      await api.deletePhase(deleteTarget.id, projectId)
                      closeDeletePhase()
                      await onRefresh()
                    } catch (err) {
                      onError(err instanceof Error ? err.message : 'Delete failed.')
                      setDeleteBusy(false)
                    }
                  })()
                }}
              >
                {deleteBusy ? 'Deleting…' : 'Delete phase'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <th className="whitespace-nowrap px-4 py-3">Est.</th>
              <th className="whitespace-nowrap px-4 py-3">Actual</th>
              <th className="px-4 py-3">Notes</th>
              <th className="w-14 min-w-[3.5rem] max-w-[3.5rem] whitespace-nowrap px-2 py-3">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {phases.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
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
                  onRequestDelete={openDeletePhase}
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
  onRequestDelete,
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
  onRequestDelete: (phase: Phase) => void
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

  const notesPreview = phase.notes?.trim() ?? ''
  const moneyDash = '—'

  return (
    <tr className={phaseTableRowClassName(phase.status)}>
      <td className="w-14 min-w-[3.5rem] max-w-[3.5rem] whitespace-nowrap px-2 py-3 align-middle">
        <button
          type="button"
          title="Edit"
          aria-label="Edit phase"
          disabled={actionsDisabled}
          className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
          onClick={() => onEdit(phase)}
        >
          <PencilIcon />
        </button>
      </td>
      <td className="px-2 py-2 align-middle">
        <div className="flex w-[2.25rem] shrink-0 flex-col flex-nowrap gap-0.5">
          <button
            type="button"
            title="Move up"
            aria-label="Move phase up"
            disabled={!canMoveUp || reordering || actionsDisabled}
            onClick={() => void movePhase('up')}
            className={iconBtnClass}
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
            aria-label="Move phase down"
            disabled={!canMoveDown || reordering || actionsDisabled}
            onClick={() => void movePhase('down')}
            className={iconBtnClass}
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
          className="rounded border border-slate-200 bg-white/80 px-2 py-1 text-xs"
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
      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
        {phase.estimatedTotal != null && Number.isFinite(phase.estimatedTotal)
          ? formatMoney(phase.estimatedTotal)
          : moneyDash}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
        {phase.actualSpend != null && Number.isFinite(phase.actualSpend)
          ? formatMoney(phase.actualSpend)
          : moneyDash}
      </td>
      <td
        className="max-w-[14rem] truncate px-4 py-3 text-slate-600"
        title={notesPreview || undefined}
      >
        {notesPreview || moneyDash}
      </td>
      <td className="w-14 min-w-[3.5rem] max-w-[3.5rem] whitespace-nowrap px-2 py-3 align-middle">
        <button
          type="button"
          title="Delete"
          aria-label="Delete phase"
          disabled={reordering || actionsDisabled}
          className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
          onClick={() => onRequestDelete(phase)}
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  )
}
