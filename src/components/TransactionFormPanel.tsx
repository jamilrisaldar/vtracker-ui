import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from '../api/dataApi'
import type {
  Account,
  AccountTransaction,
  Invoice,
  LandPlot,
  Project,
  TransactionPaymentOption,
} from '../types'
import { formatDate, formatMoney, formatMoneyInrShorthand, isInrShorthandCompressed } from '../utils/format'

export type { TransactionPaymentOption }

export function TransactionFormPanel({
  account,
  projects,
  paymentOptions,
  vendorName,
  invoiceById,
  editingTransaction,
  /** When set with `editingTransaction` null, prefill a new line from this row; create only after user edits. */
  templateForNewTransaction,
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
  templateForNewTransaction?: AccountTransaction | null
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const isEdit = editingTransaction != null
  const isCopyNew = !isEdit && templateForNewTransaction != null
  const [amount, setAmount] = useState('')
  const [entryType, setEntryType] = useState<'debit' | 'credit'>('debit')
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [bankMemo, setBankMemo] = useState('')
  const [transactionCategory, setTransactionCategory] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [plotIds, setPlotIds] = useState<string[]>([])
  const [plots, setPlots] = useState<LandPlot[]>([])
  const [plotLoading, setPlotLoading] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  /** Copy-from-row: user must change something before create is allowed. */
  const [copyUserEdited, setCopyUserEdited] = useState(false)
  const hydratingEditRef = useRef(false)

  useEffect(() => {
    setCopyUserEdited(false)
    if (editingTransaction) {
      hydratingEditRef.current = true
      setAmount(String(editingTransaction.amount))
      setEntryType(editingTransaction.entryType)
      setOccurredOn(editingTransaction.occurredOn.slice(0, 10))
      setDescription(editingTransaction.description ?? '')
      setBankMemo(editingTransaction.bankMemo ?? '')
      setTransactionCategory(editingTransaction.transactionCategory ?? '')
      setPaymentId(editingTransaction.paymentId ?? '')
      setProjectId(editingTransaction.paymentId ? '' : (editingTransaction.projectId ?? ''))
      setPlotIds(editingTransaction.plotIds ?? [])
    } else if (templateForNewTransaction) {
      const t = templateForNewTransaction
      hydratingEditRef.current = true
      setAmount(String(t.amount))
      setEntryType(t.entryType)
      setOccurredOn(t.occurredOn.slice(0, 10))
      setDescription(t.description ?? '')
      setBankMemo(t.bankMemo ?? '')
      setTransactionCategory(t.transactionCategory ?? '')
      setPaymentId(t.paymentId ?? '')
      setProjectId(t.paymentId ? '' : (t.projectId ?? ''))
      setPlotIds(t.plotIds ?? [])
    } else {
      hydratingEditRef.current = false
      setAmount('')
      setEntryType('debit')
      setOccurredOn(new Date().toISOString().slice(0, 10))
      setDescription('')
      setBankMemo('')
      setTransactionCategory('')
      setPaymentId('')
      setProjectId('')
      setPlotIds([])
    }
  }, [editingTransaction, templateForNewTransaction])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const cats = await api.listAccountTransactionCategories()
        if (!cancelled) setCategoryOptions(cats)
      } catch {
        // ignore: autocomplete is best-effort
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const plotOptions = useMemo(() => {
    return plots
      .filter((p) => (p.plotNumber ?? '').trim().length > 0)
      .map((p) => ({ id: p.id, label: p.plotNumber as string }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [plots])

  useEffect(() => {
    const pid = projectId
    if (!pid || paymentId) {
      setPlots([])
      setPlotLoading(false)
      // Avoid wiping preloaded plotIds during edit hydration; they will be validated
      // once the project plots list is loaded.
      if (paymentId) setPlotIds([])
      return
    }

    let cancelled = false
    setPlotLoading(true)
    void (async () => {
      try {
        const rows = await api.listPlots(pid)
        if (cancelled) return
        setPlots(rows)
        const allowed = new Set(rows.map((p) => p.id))
        setPlotIds((prev) => prev.filter((id) => allowed.has(id)))
        hydratingEditRef.current = false
      } catch {
        if (!cancelled) setPlots([])
      } finally {
        if (!cancelled) setPlotLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, paymentId])

  useEffect(() => {
    // When the project is cleared by the user (not during edit hydration),
    // clear any selected plots so we don't submit stale ids.
    if (projectId) return
    if (hydratingEditRef.current) return
    setPlotIds([])
  }, [projectId])

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
        {isEdit ? 'Edit transaction' : isCopyNew ? 'Copy transaction' : 'Add transaction'}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {account.name} · {account.currency}
      </p>
      {isCopyNew ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          This is a new line prefilled from the selected row. Change any field, then save — nothing is
          created until you save.
        </p>
      ) : null}
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onChange={() => {
          if (isCopyNew) setCopyUserEdited(true)
        }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!amount.trim()) return
          if (isCopyNew && !copyUserEdited) return
          onError(null)
          setSaving(true)
          try {
            const payload = {
              amount: Number(amount),
              entryType,
              occurredOn,
              description: description.trim() || undefined,
              bankMemo: bankMemo.trim() || undefined,
              transactionCategory: transactionCategory.trim() || undefined,
              paymentId: paymentId || undefined,
              projectId: paymentId ? undefined : projectId || undefined,
              plotIds: paymentId || !projectId ? undefined : plotIds,
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
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"
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
            Project plot numbers (optional)
          </span>
          <select
            multiple
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            value={plotIds}
            disabled={!projectId || Boolean(paymentId) || plotLoading || plotOptions.length === 0}
            onChange={(e) => {
              const ids = Array.from(e.target.selectedOptions).map((o) => o.value)
              setPlotIds(ids)
            }}
          >
            {plotOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {paymentId
              ? 'Disabled when a payment is linked.'
              : !projectId
                ? 'Select a project to choose plot numbers.'
                : plotLoading
                  ? 'Loading plots…'
                  : plotOptions.length === 0
                    ? 'No plot numbers found for this project.'
                    : 'Hold Ctrl/⌘ to select multiple plots.'}
          </p>
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
              const payCur = inv?.currency ?? account.currency
              const amtTitle = isInrShorthandCompressed(p.amount, payCur)
                ? formatMoney(p.amount, payCur)
                : undefined
              return (
                <option key={p.id} value={p.id} title={amtTitle}>
                  [{pname}] {formatDate(p.paidDate)} — {vendorName.get(p.vendorId) ?? 'Vendor'}{' '}
                  — {formatMoneyInrShorthand(p.amount, payCur)} (inv {inv?.invoiceNumber ?? '?'})
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
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Bank memo (optional)
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={bankMemo}
            onChange={(e) => setBankMemo(e.target.value)}
            placeholder="Original bank statement memo"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Transaction category (optional)
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={transactionCategory}
            onChange={(e) => setTransactionCategory(e.target.value)}
            list="transaction-category-options"
            placeholder="e.g. Materials, Labor, Legal, Travel"
          />
          <datalist id="transaction-category-options">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving || (isCopyNew && !copyUserEdited)}
            title={
              isCopyNew && !copyUserEdited
                ? 'Change at least one field to create this transaction'
                : undefined
            }
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {saving
              ? 'Saving…'
              : isEdit
                ? 'Save changes'
                : isCopyNew
                  ? 'Create transaction'
                  : 'Add transaction'}
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
