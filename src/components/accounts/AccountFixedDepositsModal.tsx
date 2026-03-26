import { useCallback, useEffect, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Account, AccountFixedDeposit } from '../../types'
import { todayIsoDateUtc } from '../../utils/fixedDepositMetrics'
import { FixedDepositFormPanel } from './FixedDepositFormPanel'
import { FixedDepositsTable } from './FixedDepositsTable'

export function AccountFixedDepositsModal({
  open,
  onClose,
  account,
  onError,
}: {
  open: boolean
  onClose: () => void
  account: Account
  onError: (msg: string | null) => void
}) {
  const [rows, setRows] = useState<AccountFixedDeposit[]>([])
  const [loading, setLoading] = useState(false)
  const [panelMode, setPanelMode] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<AccountFixedDeposit | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<AccountFixedDeposit | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

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
    if (!open) return
    void load()
  }, [open, load])

  const deleteOk = deleteTarget != null && deleteInput.trim() === deleteTarget.certificateNumber
  const deleteCanSubmit = deleteOk && !deleteBusy

  if (!open) return null

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

      <div
        className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fd-modal-title"
      >
        <div className="flex max-h-[min(90vh,48rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="fd-modal-title" className="text-lg font-medium text-slate-900">
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
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">
            {loading ? (
              <p className="text-sm text-slate-600">Loading…</p>
            ) : (
              <FixedDepositsTable
                rows={rows}
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
            )}
          </div>
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
