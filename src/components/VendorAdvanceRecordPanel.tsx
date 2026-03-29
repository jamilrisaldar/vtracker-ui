import { useEffect, useState } from 'react'
import * as api from '../api/dataApi'
import type { Account, GlAccount, Vendor, VendorAdvance } from '../types'

const sourceKinds = ['account', 'cash', 'other'] as const

/** Seeded default prepaid asset (must match API glConstants / migration 027). */
const DEFAULT_PREPAID_GL_ID = 'a1001350-0000-4000-8000-000000000001'

export function VendorAdvanceRecordPanel({
  projectId,
  vendors,
  initialAdvance = null,
  defaultVendorId,
  onClose,
  onSaved,
  onError,
  className,
}: {
  projectId: string
  vendors: Vendor[]
  initialAdvance?: VendorAdvance | null
  defaultVendorId?: string
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const editing = initialAdvance != null
  const [vendorId, setVendorId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [paidDate, setPaidDate] = useState('')
  const [paymentSourceKind, setPaymentSourceKind] = useState<(typeof sourceKinds)[number]>('other')
  const [sourceAccountId, setSourceAccountId] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [prepaidGlAccountId, setPrepaidGlAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<Account[]>([])
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
    let ignore = false
    void (async () => {
      try {
        const acct = await api.listAccounts()
        if (!ignore) {
          setBankAccounts(
            acct.filter(
              (a) =>
                (a.projectId === projectId || a.projectId == null || a.projectId === '') && a.kind === 'bank',
            ),
          )
        }
      } catch {
        if (!ignore) setBankAccounts([])
      }
    })()
    return () => {
      ignore = true
    }
  }, [projectId])

  useEffect(() => {
    if (initialAdvance) {
      setVendorId(initialAdvance.vendorId)
      setAmount(String(initialAdvance.amount))
      setCurrency(initialAdvance.currency)
      setPaidDate(initialAdvance.paidDate.slice(0, 10))
      setPaymentSourceKind(
        initialAdvance.paymentSourceKind === 'account' || initialAdvance.paymentSourceKind === 'cash'
          ? initialAdvance.paymentSourceKind
          : 'other',
      )
      setSourceAccountId(initialAdvance.sourceAccountId ?? '')
      setReference(initialAdvance.reference ?? '')
      setNotes(initialAdvance.notes ?? '')
      setPrepaidGlAccountId(initialAdvance.prepaidGlAccountId ?? '')
    } else {
      setVendorId(defaultVendorId ?? '')
      setAmount('')
      setCurrency('INR')
      setPaidDate('')
      setPaymentSourceKind('other')
      setSourceAccountId('')
      setReference('')
      setNotes('')
      setPrepaidGlAccountId('')
    }
  }, [initialAdvance, defaultVendorId])

  return (
    <div
      className={['bg-white p-6', className].filter(Boolean).join(' ')}
    >
      <h2 className="text-lg font-medium text-slate-900">
        {editing ? 'Edit vendor advance' : 'Record vendor advance'}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Prepayment to a vendor creates a pool you can apply when recording invoice payments.
      </p>

      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!vendorId || !amount || !paidDate) return
          const amt = Number(amount)
          if (!Number.isFinite(amt) || amt <= 0) {
            onError('Amount must be a positive number.')
            return
          }
          if (paymentSourceKind === 'account' && !sourceAccountId.trim()) {
            onError('Select the bank account when source is account.')
            return
          }
          onError(null)
          setSaving(true)
          try {
            const body = {
              vendorId,
              amount: amt,
              currency,
              paidDate,
              paymentSourceKind,
              sourceAccountId: paymentSourceKind === 'account' ? sourceAccountId.trim() : null,
              reference: reference.trim() || null,
              notes: notes.trim() || null,
              prepaidGlAccountId: prepaidGlAccountId.trim() || DEFAULT_PREPAID_GL_ID,
            }
            if (editing && initialAdvance) {
              await api.updateVendorAdvance(projectId, initialAdvance.id, body)
            } else {
              await api.createVendorAdvance(projectId, body)
            }
            await onSaved()
            onClose()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not save advance.')
          } finally {
            setSaving(false)
          }
        }}
      >
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Vendor</span>
          <select
            required
            disabled={editing}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">Select vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Advance amount</span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Currency</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 8))}
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Paid on</span>
          <input
            required
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Paid from</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={paymentSourceKind}
            onChange={(e) => setPaymentSourceKind(e.target.value as (typeof sourceKinds)[number])}
          >
            <option value="cash">Cash</option>
            <option value="account">Bank account</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Advance asset GL account</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={prepaidGlAccountId}
            onChange={(e) => setPrepaidGlAccountId(e.target.value)}
          >
            <option value="">Default (vendor prepaid / 1350)</option>
            {glAccounts
              .filter((a) => a.categoryCode === 'ASSETS')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
          </select>
        </label>

        {paymentSourceKind === 'account' ? (
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Operating account</span>
            <select
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
            >
              <option value="">— Select —</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Reference (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Notes (optional)</span>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add advance'}
          </button>
          <button
            type="button"
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
