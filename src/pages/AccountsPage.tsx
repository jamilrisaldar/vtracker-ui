import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  Account,
  AccountTransaction,
  AccountTransactionListFilters,
  Invoice,
  Project,
} from '../types'
import * as api from '../api/dataApi'
import { AccountAddPanel } from '../components/AccountAddPanel'
import { TransactionFormPanel } from '../components/TransactionFormPanel'
import { clearAccountsPage, fetchAccountsPaymentContext } from '../store/slices/accountsPageSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { formatDate, formatMoney } from '../utils/format'

function ledgerBalance(transactions: AccountTransaction[]): number {
  return transactions.reduce((sum, t) => {
    return sum + (t.entryType === 'debit' ? t.amount : -t.amount)
  }, 0)
}

const emptyTxFilterDraft = () => ({
  occurredOnFrom: '',
  occurredOnTo: '',
  projectId: '',
  descriptionContains: '',
  bankMemoContains: '',
  transactionCategoryContains: '',
})

function canonicalAmountString(amount: number): string {
  const r = Math.round(amount * 100) / 100
  if (Number.isInteger(r)) return String(r)
  const s = r.toFixed(2)
  return s.replace(/0+$/, '').replace(/\.$/, '')
}

function TrashIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 3h6m-8 4h10m-9 0v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7m-7 4v8m4-8v8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CopyIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="8"
        y="8"
        width="12"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PencilIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconBtnClass(tone: 'neutral' | 'danger' = 'neutral') {
  const base =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-teal-500/40'
  return tone === 'danger'
    ? `${base} text-red-700 hover:bg-red-50`
    : `${base} text-slate-700 hover:bg-slate-100`
}

/** Fixed columns: primary actions (first col), delete only (last col); icons must not wrap. */
const tableActionsFirstColClass = 'w-[2.75rem] min-w-[2.75rem] max-w-[2.75rem] whitespace-nowrap px-2 py-3'
const tableActionsLastColClass = 'w-[2.75rem] min-w-[2.75rem] max-w-[2.75rem] whitespace-nowrap px-2 py-3'
const txTableActionsFirstColClass = 'w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] whitespace-nowrap px-2 py-2'
/** Fixed width + single-line ellipsis for transaction description (full text on hover via `title`). */
const txDescriptionColClass = 'w-[14rem] min-w-[14rem] max-w-[14rem]'

export function AccountsPage() {
  const dispatch = useAppDispatch()
  const paymentOptions = useAppSelector((s) => s.accountsPage.paymentOptions)
  const vendorByIdRecord = useAppSelector((s) => s.accountsPage.vendorById)
  const invoiceByIdRecord = useAppSelector((s) => s.accountsPage.invoiceById)

  const [projects, setProjects] = useState<Project[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<AccountTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showAddAccountPanel, setShowAddAccountPanel] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showTransactionPanel, setShowTransactionPanel] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<AccountTransaction | null>(null)
  /** Prefill add form from this row (copy); cleared when panel closes or opening add/edit. */
  const [copyTemplateTransaction, setCopyTemplateTransaction] = useState<AccountTransaction | null>(null)
  const [txPanelSeq, setTxPanelSeq] = useState(0)

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<Account | null>(null)
  const [deleteAccountNameInput, setDeleteAccountNameInput] = useState('')
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false)

  const [deleteTransactionOpen, setDeleteTransactionOpen] = useState(false)
  const [deleteTransactionTarget, setDeleteTransactionTarget] = useState<AccountTransaction | null>(null)
  const [deleteTransactionAmountInput, setDeleteTransactionAmountInput] = useState('')
  const [deleteTransactionBusy, setDeleteTransactionBusy] = useState(false)

  const [txFilterDraft, setTxFilterDraft] = useState(emptyTxFilterDraft)
  const [txFilterApplied, setTxFilterApplied] = useState<AccountTransactionListFilters>({})
  const [txFiltersVisible, setTxFiltersVisible] = useState(false)

  const loadAccountsCore = useCallback(async (): Promise<Project[]> => {
    const [accs, plist] = await Promise.all([api.listAccounts(), api.listProjects()])
    setAccounts(accs)
    setProjects(plist)
    const balanceEntries = await Promise.all(
      accs.map(async (a) => {
        const txs = await api.listAccountTransactions(a.id)
        return [a.id, ledgerBalance(txs)] as const
      }),
    )
    setBalances(Object.fromEntries(balanceEntries))
    return plist
  }, [])

  /** Accounts + balances only (no vendor/invoice/payment lists). */
  const refreshAccountsData = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      await loadAccountsCore()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load accounts.')
      setAccounts([])
      setBalances({})
    } finally {
      setLoading(false)
    }
  }, [loadAccountsCore])

  const loadTransactions = useCallback(async (aid: string, filters?: AccountTransactionListFilters) => {
    setErr(null)
    try {
      const txs = await api.listAccountTransactions(aid, filters)
      setTransactions(txs)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load transactions.')
      setTransactions([])
    }
  }, [])

  const applyTransactionFilters = () => {
    const from = txFilterDraft.occurredOnFrom.trim()
    const to = txFilterDraft.occurredOnTo.trim()
    if (from && to && from > to) {
      setErr('Date from must be on or before date to.')
      return
    }
    setErr(null)
    const next: AccountTransactionListFilters = {}
    if (from) next.occurredOnFrom = from
    if (to) next.occurredOnTo = to
    if (txFilterDraft.descriptionContains.trim())
      next.descriptionContains = txFilterDraft.descriptionContains.trim()
    if (txFilterDraft.bankMemoContains.trim()) next.bankMemoContains = txFilterDraft.bankMemoContains.trim()
    if (txFilterDraft.transactionCategoryContains.trim())
      next.transactionCategoryContains = txFilterDraft.transactionCategoryContains.trim()
    if (txFilterDraft.projectId.trim()) next.projectId = txFilterDraft.projectId.trim()
    setTxFilterApplied(next)
  }

  const clearTransactionFilters = () => {
    setErr(null)
    setTxFilterDraft(emptyTxFilterDraft())
    setTxFilterApplied({})
  }

  const hasActiveTransactionFilters = Object.keys(txFilterApplied).length > 0

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setErr(null)
      try {
        const plist = await loadAccountsCore()
        if (cancelled) return
        await dispatch(fetchAccountsPaymentContext(plist)).unwrap()
      } catch (e) {
        if (!cancelled) {
          const msg =
            typeof e === 'string'
              ? e
              : e instanceof Error
                ? e.message
                : 'Failed to load accounts.'
          setErr(msg)
          setAccounts([])
          setBalances({})
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      dispatch(clearAccountsPage())
    }
  }, [dispatch, loadAccountsCore])

  useEffect(() => {
    if (!selectedAccountId) {
      setTransactions([])
      return
    }
    const hasFilters = Object.keys(txFilterApplied).length > 0
    void loadTransactions(selectedAccountId, hasFilters ? txFilterApplied : undefined)
  }, [selectedAccountId, loadTransactions, txFilterApplied])

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const deleteAccountNameOk =
    !!deleteAccountTarget && deleteAccountNameInput.trim() === deleteAccountTarget.name
  const deleteAccountCanSubmit = deleteAccountNameOk && !deleteAccountBusy

  const deleteTransactionExpectedAmount =
    deleteTransactionTarget ? canonicalAmountString(deleteTransactionTarget.amount) : ''
  const deleteTransactionAmountOk =
    !!deleteTransactionTarget &&
    deleteTransactionAmountInput.trim() === (deleteTransactionExpectedAmount || '')
  const deleteTransactionCanSubmit = deleteTransactionAmountOk && !deleteTransactionBusy

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>()
    projects.forEach((p) => m.set(p.id, p.name))
    return m
  }, [projects])

  const vendorName = useMemo(
    () => new Map<string, string>(Object.entries(vendorByIdRecord)),
    [vendorByIdRecord],
  )
  const invoiceById = useMemo(() => {
    const m = new Map<string, Invoice>()
    Object.entries(invoiceByIdRecord).forEach(([id, inv]) => m.set(id, inv))
    return m
  }, [invoiceByIdRecord])

  return (
    <div className="mx-auto max-w-6xl">
      {deleteAccountOpen && deleteAccountTarget ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-account-title" className="text-lg font-medium text-slate-900">
              Delete account
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove this account and all its transactions. This cannot be
              undone.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Type the account name exactly as shown below to confirm:
            </p>
            <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-900">
              {deleteAccountTarget.name}
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Account name</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={deleteAccountNameInput}
                onChange={(e) => setDeleteAccountNameInput(e.target.value)}
                placeholder={deleteAccountTarget.name}
                autoComplete="off"
                autoFocus
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={deleteAccountBusy}
                onClick={() => {
                  setDeleteAccountOpen(false)
                  setDeleteAccountTarget(null)
                  setDeleteAccountNameInput('')
                  setDeleteAccountBusy(false)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={!deleteAccountCanSubmit}
                onClick={() => {
                  if (!deleteAccountCanSubmit || !deleteAccountTarget) return
                  setDeleteAccountBusy(true)
                  setErr(null)
                  void (async () => {
                    try {
                      await api.deleteAccount(deleteAccountTarget.id)
                      if (selectedAccountId === deleteAccountTarget.id) setSelectedAccountId(null)
                      await refreshAccountsData()
                      setDeleteAccountOpen(false)
                      setDeleteAccountTarget(null)
                      setDeleteAccountNameInput('')
                      setDeleteAccountBusy(false)
                    } catch (er) {
                      setErr(er instanceof Error ? er.message : 'Delete failed.')
                      setDeleteAccountBusy(false)
                    }
                  })()
                }}
              >
                {deleteAccountBusy ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTransactionOpen && deleteTransactionTarget && selectedAccount ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-transaction-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-transaction-title" className="text-lg font-medium text-slate-900">
              Delete transaction
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove this transaction from the account ledger. This cannot be
              undone.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Type the transaction amount exactly as shown below to confirm:
            </p>
            <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-900">
              {deleteTransactionExpectedAmount} ({selectedAccount.currency})
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Transaction amount</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={deleteTransactionAmountInput}
                onChange={(e) => setDeleteTransactionAmountInput(e.target.value)}
                placeholder={deleteTransactionExpectedAmount}
                autoComplete="off"
                autoFocus
                inputMode="decimal"
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={deleteTransactionBusy}
                onClick={() => {
                  setDeleteTransactionOpen(false)
                  setDeleteTransactionTarget(null)
                  setDeleteTransactionAmountInput('')
                  setDeleteTransactionBusy(false)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={!deleteTransactionCanSubmit}
                onClick={() => {
                  if (!deleteTransactionCanSubmit || !deleteTransactionTarget || !selectedAccount)
                    return
                  setDeleteTransactionBusy(true)
                  setErr(null)
                  void (async () => {
                    try {
                      await api.deleteAccountTransaction(deleteTransactionTarget.id, selectedAccount.id)
                      await refreshAccountsData()
                      {
                        const hasFilters = Object.keys(txFilterApplied).length > 0
                        await loadTransactions(
                          selectedAccount.id,
                          hasFilters ? txFilterApplied : undefined,
                        )
                      }
                      setDeleteTransactionOpen(false)
                      setDeleteTransactionTarget(null)
                      setDeleteTransactionAmountInput('')
                      setDeleteTransactionBusy(false)
                    } catch (er) {
                      setErr(er instanceof Error ? er.message : 'Delete failed.')
                      setDeleteTransactionBusy(false)
                    }
                  })()
                }}
              >
                {deleteTransactionBusy ? 'Deleting…' : 'Delete transaction'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Accounts</h1>
          <p className="mt-1 text-sm text-slate-600">
            System-wide bank and cash accounts. Optionally tag an account or transaction to a
            project, or link a line to a vendor payment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            onClick={() => {
              setEditingAccount(null)
              setShowAddAccountPanel(true)
            }}
          >
            Add account
          </button>
          <Link
            to="/projects"
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            ← Projects
          </Link>
        </div>
      </div>

      {err && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </p>
      )}

      {loading && accounts.length === 0 ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-medium text-slate-900">Accounts</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className={tableActionsFirstColClass}>
                      <span className="sr-only">Actions</span>
                    </th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Project tag</th>
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className={tableActionsLastColClass}>
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No accounts yet. Use Add account to create one.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((a) => (
                      <tr
                        key={a.id}
                        className={[
                          'cursor-pointer border-b border-slate-100',
                          selectedAccountId === a.id ? 'bg-teal-50' : 'hover:bg-slate-50',
                        ].join(' ')}
                        onClick={() => {
                          setTxFilterDraft(emptyTxFilterDraft())
                          setTxFilterApplied({})
                          setSelectedAccountId(a.id)
                        }}
                      >
                        <td className={tableActionsFirstColClass} onClick={(e) => e.stopPropagation()}>
                          <div className="flex w-[2.75rem] shrink-0 flex-nowrap justify-start">
                            <button
                              type="button"
                              className={iconBtnClass('neutral')}
                              aria-label={`Edit account ${a.name}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingAccount(a)
                                setShowAddAccountPanel(true)
                              }}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                        <td className="px-4 py-3 text-slate-600">{a.accountLocation ?? '—'}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{a.kind}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {a.projectId ? projectNameById.get(a.projectId) ?? '—' : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{a.currency}</td>
                        <td className="px-4 py-3 font-mono text-slate-800">
                          {formatMoney(balances[a.id] ?? 0, a.currency)}
                        </td>
                        <td className={tableActionsLastColClass} onClick={(e) => e.stopPropagation()}>
                          <div className="flex w-[2.75rem] shrink-0 flex-nowrap justify-center">
                            <button
                              type="button"
                              className={iconBtnClass('danger')}
                              aria-label={`Remove account ${a.name}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteAccountTarget(a)
                                setDeleteAccountNameInput('')
                                setDeleteAccountBusy(false)
                                setDeleteAccountOpen(true)
                              }}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Balance = sum(debits) − sum(credits) for bank/cash (asset) accounts.
            </p>
          </section>

          {selectedAccount && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-medium text-slate-900">
                  Transactions — {selectedAccount.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-expanded={txFiltersVisible}
                    aria-controls="account-tx-filters-panel"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                    onClick={() => {
                      setTxFiltersVisible((prev) => {
                        if (prev) return false
                        setTxFilterDraft({
                          occurredOnFrom: txFilterApplied.occurredOnFrom ?? '',
                          occurredOnTo: txFilterApplied.occurredOnTo ?? '',
                          projectId: txFilterApplied.projectId ?? '',
                          descriptionContains: txFilterApplied.descriptionContains ?? '',
                          bankMemoContains: txFilterApplied.bankMemoContains ?? '',
                          transactionCategoryContains:
                            txFilterApplied.transactionCategoryContains ?? '',
                        })
                        return true
                      })
                    }}
                  >
                    {txFiltersVisible ? 'Hide filters' : 'Show filters'}
                    {hasActiveTransactionFilters && !txFiltersVisible ? (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                        Active
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                    onClick={() => {
                      setEditingTransaction(null)
                      setCopyTemplateTransaction(null)
                      setTxPanelSeq((s) => s + 1)
                      setShowTransactionPanel(true)
                    }}
                  >
                    Add transaction
                  </button>
                </div>
              </div>

              {txFiltersVisible ? (
                <div
                  id="account-tx-filters-panel"
                  className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Filter transactions
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <label className="block text-xs text-slate-600 sm:col-span-2 lg:col-span-1">
                    <span className="font-medium">Project</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      value={txFilterDraft.projectId}
                      onChange={(e) =>
                        setTxFilterDraft((d) => ({ ...d, projectId: e.target.value }))
                      }
                    >
                      <option value="">All projects</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-slate-600">
                    <span className="font-medium">Date from</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      value={txFilterDraft.occurredOnFrom}
                      onChange={(e) =>
                        setTxFilterDraft((d) => ({ ...d, occurredOnFrom: e.target.value }))
                      }
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    <span className="font-medium">Date to</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      value={txFilterDraft.occurredOnTo}
                      onChange={(e) =>
                        setTxFilterDraft((d) => ({ ...d, occurredOnTo: e.target.value }))
                      }
                    />
                  </label>
                  <label className="block text-xs text-slate-600 sm:col-span-2 lg:col-span-1">
                    <span className="font-medium">Description contains</span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      value={txFilterDraft.descriptionContains}
                      onChange={(e) =>
                        setTxFilterDraft((d) => ({ ...d, descriptionContains: e.target.value }))
                      }
                      placeholder="Text in description"
                      autoComplete="off"
                    />
                  </label>
                  <label className="block text-xs text-slate-600 sm:col-span-2 lg:col-span-1">
                    <span className="font-medium">Bank memo contains</span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      value={txFilterDraft.bankMemoContains}
                      onChange={(e) =>
                        setTxFilterDraft((d) => ({ ...d, bankMemoContains: e.target.value }))
                      }
                      placeholder="Text in memo"
                      autoComplete="off"
                    />
                  </label>
                  <label className="block text-xs text-slate-600 sm:col-span-2 lg:col-span-1">
                    <span className="font-medium">Category contains</span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      value={txFilterDraft.transactionCategoryContains}
                      onChange={(e) =>
                        setTxFilterDraft((d) => ({ ...d, transactionCategoryContains: e.target.value }))
                      }
                      placeholder="Category"
                      autoComplete="off"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
                    onClick={applyTransactionFilters}
                  >
                    Apply filters
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={clearTransactionFilters}
                  >
                    Clear filters
                  </button>
                </div>
                </div>
              ) : null}

              <div className="mt-4 max-h-[min(28rem,calc(100vh-14rem))] overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 shadow-sm [&_th]:bg-slate-50">
                    <tr>
                      <th className={`${txTableActionsFirstColClass} bg-slate-50`}>
                        <span className="sr-only">Actions</span>
                      </th>
                      <th className="whitespace-nowrap px-3 py-2">Date</th>
                      <th className="whitespace-nowrap px-3 py-2">Entry</th>
                      <th className="whitespace-nowrap px-3 py-2">Amount</th>
                      <th className="whitespace-nowrap px-3 py-2">Running balance</th>
                      <th className="whitespace-nowrap px-3 py-2">Project</th>
                      <th className="whitespace-nowrap px-3 py-2">Plots</th>
                      <th className={`whitespace-nowrap px-3 py-2 ${txDescriptionColClass}`}>Description</th>
                      <th className="whitespace-nowrap px-3 py-2">Bank memo</th>
                      <th className="whitespace-nowrap px-3 py-2">Category</th>
                      <th className="whitespace-nowrap px-3 py-2">Payment</th>
                      <th className={`${tableActionsLastColClass} bg-slate-50`}>
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="bg-white px-3 py-6 text-center text-slate-500">
                          {hasActiveTransactionFilters
                            ? 'No transactions match these filters.'
                            : 'No transactions yet.'}
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => (
                        <tr
                          key={t.id}
                          className="odd:bg-white even:bg-slate-50/90 hover:bg-teal-50/40"
                        >
                          <td className={txTableActionsFirstColClass}>
                            <div className="flex w-[5.5rem] shrink-0 flex-nowrap items-center gap-2">
                              <button
                                type="button"
                                className={iconBtnClass('neutral')}
                                aria-label="Edit transaction"
                                onClick={() => {
                                  setCopyTemplateTransaction(null)
                                  setEditingTransaction(t)
                                  setTxPanelSeq((s) => s + 1)
                                  setShowTransactionPanel(true)
                                }}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className={iconBtnClass('neutral')}
                                aria-label="Copy transaction to new line"
                                title="Copy to new transaction"
                                onClick={() => {
                                  setEditingTransaction(null)
                                  setCopyTemplateTransaction(t)
                                  setTxPanelSeq((s) => s + 1)
                                  setShowTransactionPanel(true)
                                }}
                              >
                                <CopyIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{formatDate(t.occurredOn)}</td>
                          <td
                            className={[
                              'px-3 py-2 capitalize',
                              t.entryType === 'debit' ? 'text-emerald-700' : 'text-red-700',
                            ].join(' ')}
                          >
                            {t.entryType}
                          </td>
                          <td
                            className={[
                              'px-3 py-2 font-mono',
                              t.entryType === 'debit' ? 'text-emerald-700' : 'text-red-700',
                            ].join(' ')}
                          >
                            {formatMoney(t.amount, selectedAccount.currency)}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-800">
                            {t.runningBalance == null
                              ? '—'
                              : formatMoney(t.runningBalance, selectedAccount.currency)}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {t.projectId ? projectNameById.get(t.projectId) ?? '—' : '—'}
                          </td>
                          <td
                            className="max-w-[14rem] px-3 py-2 text-xs text-slate-600"
                            title={t.plotNumberLabels ?? undefined}
                          >
                            {t.plotNumberLabels ?? '—'}
                          </td>
                          <td
                            className={`overflow-hidden px-3 py-2 align-middle ${txDescriptionColClass}`}
                          >
                            {t.description?.trim() ? (
                              <div
                                className="truncate text-slate-600"
                                title={t.description}
                              >
                                {t.description}
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td
                            className="max-w-[12rem] truncate px-3 py-2 text-xs text-slate-600"
                            title={t.bankMemo ?? undefined}
                          >
                            {t.bankMemo ?? '—'}
                          </td>
                          <td className="max-w-[10rem] truncate px-3 py-2 text-xs text-slate-600" title={t.transactionCategory ?? undefined}>
                            {t.transactionCategory ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {t.paymentId ? (
                              <span className="font-mono" title={t.paymentId}>
                                {t.paymentId.slice(0, 8)}…
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className={tableActionsLastColClass}>
                            <div className="flex w-[2.75rem] shrink-0 flex-nowrap justify-center">
                              <button
                                type="button"
                                className={iconBtnClass('danger')}
                                aria-label={`Remove transaction ${formatMoney(t.amount, selectedAccount.currency)}`}
                                onClick={() => {
                                  setDeleteTransactionTarget(t)
                                  setDeleteTransactionAmountInput('')
                                  setDeleteTransactionBusy(false)
                                  setDeleteTransactionOpen(true)
                                }}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {showAddAccountPanel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            <AccountAddPanel
              projects={projects}
              editingAccount={editingAccount}
              onClose={() => {
                setShowAddAccountPanel(false)
                setEditingAccount(null)
              }}
              onRefresh={refreshAccountsData}
              onError={setErr}
              className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
            />
          </div>
        </div>
      )}

      {showTransactionPanel && selectedAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            <TransactionFormPanel
              key={`${editingTransaction?.id ?? 'new'}-${copyTemplateTransaction?.id ?? ''}-${txPanelSeq}`}
              account={selectedAccount}
              projects={projects}
              paymentOptions={paymentOptions}
              vendorName={vendorName}
              invoiceById={invoiceById}
              editingTransaction={editingTransaction}
              templateForNewTransaction={copyTemplateTransaction}
              onClose={() => {
                setShowTransactionPanel(false)
                setEditingTransaction(null)
                setCopyTemplateTransaction(null)
              }}
              onSaved={async () => {
                await refreshAccountsData()
                if (selectedAccountId) {
                  const hasFilters = Object.keys(txFilterApplied).length > 0
                  await loadTransactions(
                    selectedAccountId,
                    hasFilters ? txFilterApplied : undefined,
                  )
                }
              }}
              onError={setErr}
              className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
