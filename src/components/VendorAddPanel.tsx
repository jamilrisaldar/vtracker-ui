import { useEffect, useState } from 'react'
import * as api from '../api/dataApi'
import type { GlAccount, Vendor, VendorKind } from '../types'

const VENDOR_KIND_OPTIONS: { value: VendorKind; label: string }[] = [
  { value: 'company', label: 'Company' },
  { value: 'person', label: 'Person' },
  { value: 'government', label: 'Government' },
]

export function VendorAddPanel({
  projectId,
  initialVendor = null,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  projectId: string
  initialVendor?: Vendor | null
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const editing = initialVendor != null
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [vendorKind, setVendorKind] = useState<VendorKind>('company')
  const [gstCentralGlAccountId, setGstCentralGlAccountId] = useState('')
  const [gstStateGlAccountId, setGstStateGlAccountId] = useState('')
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const list = await api.listGlAccounts()
        if (!ignore) setGlAccounts(list.filter((a) => a.isActive !== false))
      } catch {
        if (!ignore) setGlAccounts([])
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const id7020 = glAccounts.find((a) => a.code === '7020')?.id ?? ''
    const id7030 = glAccounts.find((a) => a.code === '7030')?.id ?? ''
    if (initialVendor) {
      setName(initialVendor.name)
      setContact(initialVendor.contactName ?? '')
      setEmail(initialVendor.email ?? '')
      setPhone(initialVendor.phone ?? '')
      setVendorKind(initialVendor.vendorKind ?? 'company')
      setGstCentralGlAccountId(initialVendor.gstCentralGlAccountId ?? id7020)
      setGstStateGlAccountId(initialVendor.gstStateGlAccountId ?? id7030)
    } else {
      setName('')
      setContact('')
      setEmail('')
      setPhone('')
      setVendorKind('company')
      setGstCentralGlAccountId(id7020)
      setGstStateGlAccountId(id7030)
    }
  }, [initialVendor, glAccounts])

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
        {editing ? 'Edit vendor' : 'Add vendor'}
      </h2>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          onError(null)
          setSaving(true)
          try {
            const gcGl = gstCentralGlAccountId.trim() ? gstCentralGlAccountId.trim() : null
            const gsGl = gstStateGlAccountId.trim() ? gstStateGlAccountId.trim() : null
            if (editing && initialVendor) {
              await api.updateVendor(
                initialVendor.id,
                {
                  name: name.trim(),
                  vendorKind,
                  contactName: contact.trim() || undefined,
                  email: email.trim() || undefined,
                  phone: phone.trim() || undefined,
                  gstCentralGlAccountId: gcGl,
                  gstStateGlAccountId: gsGl,
                },
                projectId,
              )
            } else {
              await api.createVendor({
                projectId,
                name,
                vendorKind,
                contactName: contact || undefined,
                email: email || undefined,
                phone: phone || undefined,
                gstCentralGlAccountId: gcGl ?? undefined,
                gstStateGlAccountId: gsGl ?? undefined,
              })
            }
            await onRefresh()
            onClose()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not save vendor.')
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
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Vendor type</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={vendorKind}
            onChange={(e) => setVendorKind(e.target.value as VendorKind)}
          >
            {VENDOR_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Central GST GL (invoice accrual input tax; default 7020)
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={gstCentralGlAccountId}
            onChange={(e) => setGstCentralGlAccountId(e.target.value)}
          >
            <option value="">— Chart default (7020) —</option>
            {glAccounts
              .filter((a) => a.categoryCode === 'TAXES')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            State GST GL (invoice accrual input tax; default 7030)
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={gstStateGlAccountId}
            onChange={(e) => setGstStateGlAccountId(e.target.value)}
          >
            <option value="">— Chart default (7030) —</option>
            {glAccounts
              .filter((a) => a.categoryCode === 'TAXES')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
          </select>
        </label>
        <p className="sm:col-span-2 text-xs text-slate-500">
          Used for all invoices for this vendor when Central GST and/or State GST amounts are entered.
        </p>

        <div className="sm:col-span-2 mt-1 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save vendor'}
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
