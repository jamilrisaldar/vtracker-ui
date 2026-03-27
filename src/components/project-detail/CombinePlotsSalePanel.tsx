import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { LandPlot } from '../../types'
import { plotStatusLabel } from './constants'

export function CombinePlotsSalePanel({
  projectId,
  plots,
  mode,
  onClose,
  onRefresh,
  onError,
  readOnly = false,
  className = '',
}: {
  projectId: string
  plots: LandPlot[]
  mode: 'create' | { editGroupId: string }
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  readOnly?: boolean
  className?: string
}) {
  const editGroupId = mode === 'create' ? null : mode.editGroupId
  const [displayName, setDisplayName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(editGroupId != null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(false)

  const loadEdit = useCallback(async () => {
    if (!editGroupId) return
    setLoading(true)
    onError(null)
    try {
      const g = await api.getCombinedPlotSaleGroup(editGroupId, projectId)
      setDisplayName(g.displayName)
      setSelected(new Set(g.plotIds))
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load group')
    } finally {
      setLoading(false)
    }
  }, [editGroupId, projectId, onError])

  useEffect(() => {
    if (editGroupId) void loadEdit()
    else {
      setDisplayName('')
      setSelected(new Set())
    }
  }, [editGroupId, loadEdit])

  const toggle = (plotId: string) => {
    if (readOnly) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(plotId)) next.delete(plotId)
      else next.add(plotId)
      return next
    })
  }

  const eligiblePlots = useMemo(() => {
    return [...plots].sort((a, b) => {
      const na = a.plotNumber?.trim() || a.id
      const nb = b.plotNumber?.trim() || b.id
      return na.localeCompare(nb)
    })
  }, [plots])

  const submit = async () => {
    const ids = [...selected]
    if (ids.length < 2) {
      onError('Select at least two plots to sell together.')
      return
    }
    setSaving(true)
    onError(null)
    try {
      if (editGroupId) {
        await api.updateCombinedPlotSaleGroup(editGroupId, projectId, {
          displayName: displayName.trim(),
          plotIds: ids,
        })
      } else {
        await api.createCombinedPlotSaleGroup({
          projectId,
          displayName: displayName.trim(),
          plotIds: ids,
        })
      }
      await onRefresh()
      onClose()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const removeGroup = async () => {
    if (!editGroupId) return
    setDeleting(true)
    onError(null)
    try {
      await api.deleteCombinedPlotSaleGroup(editGroupId, projectId)
      await onRefresh()
      onClose()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not remove combined sale')
    } finally {
      setDeleting(false)
      setRemoveConfirm(false)
    }
  }

  return (
    <aside
      className={`flex h-full flex-col border-l border-slate-200 bg-white ${className}`}
      aria-labelledby="combine-plots-title"
    >
      <div className="shrink-0 border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="combine-plots-title" className="text-lg font-semibold text-slate-900">
            {editGroupId ? 'Combined plot sale' : 'Combine plots for one sale'}
          </h2>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <span className="font-medium">One buyer, several plots:</span> checked plots share the same
          sale details and the same payment history. Open <strong>Sale &amp; payments</strong> from any
          plot in the group to record money received—it applies to the whole set.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Label (optional)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="e.g. Sharma family — lots 4 & 7"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={readOnly}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Shown on the table so you can spot the deal at a glance.
              </span>
            </label>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Plots in this combined sale
              </p>
              <ul className="mt-2 max-h-[min(50vh,20rem)] space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {eligiblePlots.map((p) => {
                  const inGroup = selected.has(p.id)
                  const blocked =
                    readOnly ||
                    (p.combinedSale != null &&
                      (editGroupId == null || p.combinedSale.groupId !== editGroupId))
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm ${
                          inGroup ? 'bg-violet-50' : 'hover:bg-slate-50'
                        } ${blocked ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={inGroup}
                          disabled={blocked}
                          onChange={() => toggle(p.id)}
                        />
                        <span>
                          <span className="font-medium text-slate-900">
                            {p.plotNumber?.trim() ? `Plot #${p.plotNumber.trim()}` : `Plot ${p.id.slice(0, 8)}…`}
                          </span>
                          <span className="ml-2 text-slate-500">{plotStatusLabel(p.status)}</span>
                          {p.combinedSale != null &&
                          (editGroupId == null || p.combinedSale.groupId !== editGroupId) ? (
                            <span className="mt-0.5 block text-xs text-amber-800">
                              Already in another combined sale — edit that group to change membership.
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-slate-100 pt-4">
        {!readOnly ? (
          <>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void submit()}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editGroupId ? 'Save changes' : 'Create combined sale'}
            </button>
            {editGroupId ? (
              removeConfirm ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <p>This deletes the group and all shared payment lines for this deal. Plots stay; sale data is removed.</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                      onClick={() => void removeGroup()}
                    >
                      {deleting ? 'Removing…' : 'Yes, remove combined sale'}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                      onClick={() => setRemoveConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full text-sm font-medium text-red-700 hover:underline"
                  onClick={() => setRemoveConfirm(true)}
                >
                  Remove combined sale…
                </button>
              )
            ) : null}
          </>
        ) : (
          <p className="text-xs text-amber-800/90">View-only: cannot change combined sales.</p>
        )}
      </div>
    </aside>
  )
}
