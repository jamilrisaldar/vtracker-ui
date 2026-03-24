import { useEffect, useState } from 'react'
import * as api from '../api/dataApi'
import type { Account, AccountTransaction, Invoice, Payment, Project } from '../types'
import { formatDate, formatMoney } from '../utils/format'

export type TransactionPaymentOption = {
  payment: Payment
  projectId: string
  projectName: string
}

export function TransactionFormPanel({
  account,
  projects,
  paymentOptions,
  vendorName,
  invoiceById,
  editingTransaction,
  onClose,
  onSaved,
  onError,
  className,
}: {
  account: Account
  projects: Project[]
  paymentOptions: TransactionPaymentOption[]
  vendorName: Map<string, string>
  invoiceById: Map<string, Invoice>
  editingTransaction: AccountTransaction | null
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const isEdit = editingTransaction != null
  const [amount, setAmount] = useState('')
  const [entryType, setEntryType] = useState<'debit' | 'credit'>('debit')
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingTransaction) {
      setAmount(String(editingTransaction.amount))
      setEntryType(editingTransaction.entryType)
      setOccurredOn(editingTransaction.occurredOn.slice(0, 10))
      setDescription(editingTransaction.description ?? '')
      setPaymentId(editingTransaction.paymentId ?? '')
      setProjectId(editingTransaction.paymentId ? '' : (editingTransaction.projectId ?? ''))
    } else {
      setAmount('')
      setEntryType('debit')
      setOccurredOn(new Date().toISOString().slice(0, 10))
      setDescription('')
      setPaymentId('')
      setProjectId('')
    }
  }, [editingTransaction])

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
        {isEdit ? 'Edit transaction' : 'Add transaction'}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {account.name} · {account.currency}
      </p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!amount.trim()) return
          onError(null)
          setSaving(true)
          try {
            const payload = {
              amount: Number(amount),
              entryType,
              occurredOn,
              description: description.trim() || undefined,
              paymentId: paymentId || undefined,
              projectId: paymentId ? undefined : projectId || undefined,
            }
            if (isEdit && editingTransaction) {
              await api.updateAccountTransaction(editingTransaction.id, account.id, payload)
            } else {
              await api.createAccountTransaction({
                accountId: account.id,
                ...payload,
              })
            }
            await onSaved()
            onClose()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not save transaction.')
          } finally {
            setSaving(false)
          }
        }}
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Amount</span>
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
          <span className="text-xs font-medium text-slate-600">Entry</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as 'debit' | 'credit')}
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Date</span>
          <input
            required
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Project tag (optional, ignored if a payment is linked)
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={Boolean(paymentId)}
          >
            <option value="">— None —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Link to vendor payment (optional)
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={paymentId}
            onChange={(e) => {
              setPaymentId(e.target.value)
              if (e.target.value) setProjectId('')
            }}
          >
            <option value="">— None —</option>
            {paymentOptions.map(({ payment: p, projectName: pname }) => {
              const inv = invoiceById.get(p.invoiceId)
              return (
                <option key={p.id} value={p.id}>
                  [{pname}] {formatDate(p.paidDate)} — {vendorName.get(p.vendorId) ?? 'Vendor'}{' '}
                  — {formatMoney(p.amount, inv?.currency)} (inv {inv?.invoiceNumber ?? '?'})
                </option>
              )
            })}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Description (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add transaction'}
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
