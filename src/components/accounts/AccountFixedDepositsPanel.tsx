import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Account, AccountFixedDeposit, AccountFixedDepositStatus } from '../../types'
import {
  ACCOUNT_FIXED_DEPOSIT_STATUSES,
  ACCOUNT_FIXED_DEPOSIT_STATUS_LABELS,
} from '../../types'
import { todayIsoDateUtc } from '../../utils/fixedDepositMetrics'
import { FixedDepositFormPanel } from './FixedDepositFormPanel'
import { FixedDepositsTable } from './FixedDepositsTable'

function initialStatusFilter(): Record<AccountFixedDepositStatus, boolean> {
  return Object.fromEntries(ACCOUNT_FIXED_DEPOSIT_STATUSES.map((s) => [s, true])) as Record<
    AccountFixedDepositStatus,
    boolean
  >
}

export function AccountFixedDepositsPanel({
  account,
  onError,
  active,
  className = '',
  showCloseInHeader = false,
  onClose,
  headingId,
  scrollableBody = false,
}: {
  account: Account
  onError: (msg: string | null) => void
  /** When true, loads and shows certificates (e.g. visible tab). */
  active: boolean
  className?: string
  showCloseInHeader?: boolean
  onClose?: () => void
  headingId?: string
  /** Use inside a flex column modal so the table area scrolls. */
  scrollableBody?: boolean
}) {
  const [rows, setRows] = useState<AccountFixedDeposit[]>([])
  const [loading, setLoading] = useState(false)
  const [panelMode, setPanelMode] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<AccountFixedDeposit | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<AccountFixedDeposit | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)

  const load = useCallback(async () => {
    onError(null)
    setLoading(true)
    try {
      const list = await api.listAccountFixedDeposits(account.id)
      setRows(list)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load certificates.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [account.id, onError])

  useEffect(() => {
    if (!active) return
    void load()
  }, [active, load])

  useEffect(() => {
    setStatusFilter(initialStatusFilter())
  }, [account.id])

  const effectiveStatusSelection = useMemo(() => {
    const on = ACCOUNT_FIXED_DEPOSIT_STATUSES.filter((s) => statusFilter[s])
    if (on.length === 0) return new Set(ACCOUNT_FIXED_DEPOSIT_STATUSES)
    return new Set(on)
  }, [statusFilter])

  const visibleRows = useMemo(
    () => rows.filter((r) => effectiveStatusSelection.has(r.status)),
    [rows, effectiveStatusSelection],
  )

  const deleteOk = deleteTarget != null && deleteInput.trim() === deleteTarget.certificateNumber
  const deleteCanSubmit = deleteOk && !deleteBusy

  return (
    <>
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-fd-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-fd-title" className="text-lg font-medium text-slate-900">
              Delete certificate
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This cannot be undone. Type the certificate number exactly as shown:
            </p>
            <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 font-mono font-medium text-slate-900">
              {deleteTarget.certificateNumber}
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Certificate #</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={deleteTarget.certificateNumber}
                autoComplete="off"
                autoFocus
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteInput('')
                  setDeleteBusy(false)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={!deleteCanSubmit}
                onClick={() => {
                  if (!deleteCanSubmit || !deleteTarget) return
                  setDeleteBusy(true)
                  onError(null)
                  void (async () => {
                    try {
                      await api.deleteAccountFixedDeposit(deleteTarget.id, account.id)
                      setDeleteTarget(null)
                      setDeleteInput('')
                      setDeleteBusy(false)
                      await load()
                    } catch (er) {
                      onError(er instanceof Error ? er.message : 'Delete failed.')
                      setDeleteBusy(false)
                    }
                  })()
                }}
              >
                {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={className}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-5">
          <div>
            <h2
              id={headingId}
              className="text-lg font-medium text-slate-900"
            >
              Fixed deposits &amp; investment certificates
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {account.name} · Accrual figures use today ({todayIsoDateUtc()}) and simple interest
              (365-day year).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              onClick={() => {
                setEditing(null)
                setPanelMode('add')
              }}
            >
              Add certificate
            </button>
            {showCloseInHeader && onClose ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setPanelMode(null)
                  setEditing(null)
                  onClose()
                }}
              >
                Close
              </button>
            ) : null}
          </div>
        </div>
        <div
          className={[
            'min-h-0 px-6 pb-6 pt-4',
            scrollableBody ? 'min-h-0 flex-1 overflow-auto' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {loading ? (
            <p className="text-sm text-slate-600">Loading…</p>
          ) : (
            <>
              <div
                className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm"
                role="group"
                aria-label="Filter by certificate status"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </span>
                {ACCOUNT_FIXED_DEPOSIT_STATUSES.map((s) => (
                  <label
                    key={s}
                    className="inline-flex cursor-pointer items-center gap-2 text-slate-800"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                      checked={statusFilter[s]}
                      onChange={() => setStatusFilter((f) => ({ ...f, [s]: !f[s] }))}
                    />
                    <span>{ACCOUNT_FIXED_DEPOSIT_STATUS_LABELS[s]}</span>
                  </label>
                ))}
              </div>
              <FixedDepositsTable
                rows={visibleRows}
                summaryRows={rows}
                currency={account.currency}
                onEdit={(d) => {
                  setEditing(d)
                  setPanelMode('edit')
                }}
                onDelete={(d) => {
                  setDeleteInput('')
                  setDeleteTarget(d)
                }}
              />
            </>
          )}
        </div>
      </div>

      {panelMode !== null ? (
        <div className="fixed inset-0 z-[66] bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-lg">
            <FixedDepositFormPanel
              mode={panelMode}
              accountId={account.id}
              deposit={panelMode === 'edit' ? editing ?? undefined : undefined}
              onClose={() => {
                setPanelMode(null)
                setEditing(null)
              }}
              onSaved={load}
              onError={onError}
              className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
