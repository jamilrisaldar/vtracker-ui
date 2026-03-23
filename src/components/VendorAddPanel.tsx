import { useState } from 'react'
import * as api from '../api/dataApi'

export function VendorAddPanel({
  projectId,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  projectId: string
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div
      className={[
        'rounded-none border border-slate-200 bg-white p-6 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="text-lg font-medium text-slate-900">Add vendor</h2>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          onError(null)
          setSaving(true)
          try {
            await api.createVendor({
              projectId,
              name,
              contactName: contact || undefined,
              email: email || undefined,
              phone: phone || undefined,
            })
            await onRefresh()
            onClose()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not add vendor.')
          } finally {
            setSaving(false)
          }
        }}
      >
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Name</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Contact</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Email</span>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Phone</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>

        <div className="sm:col-span-2 mt-1 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save vendor'}
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

