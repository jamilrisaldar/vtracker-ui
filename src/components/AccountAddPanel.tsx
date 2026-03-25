import { useEffect, useState } from 'react'
import * as api from '../api/dataApi'
import type { Account, Project } from '../types'

export function AccountAddPanel({
  projects,
  editingAccount,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  projects: Project[]
  editingAccount?: Account | null
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const isEdit = editingAccount != null
  const [kind, setKind] = useState<'bank' | 'cash'>('bank')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [accountLocation, setAccountLocation] = useState('')
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingAccount) {
      setKind(editingAccount.kind)
      setName(editingAccount.name)
      setCurrency(editingAccount.currency)
      setAccountLocation(editingAccount.accountLocation ?? '')
      setProjectId(editingAccount.projectId ?? '')
    } else {
      setKind('bank')
      setName('')
      setCurrency('INR')
      setAccountLocation('')
      setProjectId('')
    }
  }, [editingAccount])

  return (
    <div
      className={[
        'rounded-none border border-slate-200 bg-white p-6 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="text-lg font-medium text-slate-900">
        {isEdit ? 'Edit account' : 'Add account'}
      </h2>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          onError(null)
          setSaving(true)
          try {
            if (isEdit && editingAccount) {
              await api.updateAccount(editingAccount.id, {
                kind,
                name: name.trim(),
                currency: currency.trim() || 'INR',
                accountLocation: accountLocation.trim() || undefined,
                projectId: projectId || undefined,
              })
            } else {
              await api.createAccount({
                kind,
                name: name.trim(),
                currency: currency.trim() || 'INR',
                accountLocation: accountLocation.trim() || undefined,
                projectId: projectId || undefined,
              })
            }
            await onRefresh()
            onClose()
          } catch (err) {
            onError(
              err instanceof Error
                ? err.message
                : isEdit
                  ? 'Could not update account.'
                  : 'Could not create account.',
            )
          } finally {
            setSaving(false)
          }
        }}
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Type</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'bank' | 'cash')}
          >
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Name</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main checking"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Bank / institution (optional)
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={accountLocation}
            onChange={(e) => setAccountLocation(e.target.value)}
            placeholder="e.g. Chase, Petty cash box"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Currency</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Tag to project (optional)
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">— All projects / shared —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add account'}
          </button>
          <button
            type="button"
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
