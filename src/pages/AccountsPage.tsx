import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Account, AccountTransaction, Invoice, Project } from '../types'
import * as api from '../api/dataApi'
import { AccountAddPanel } from '../components/AccountAddPanel'
import { TransactionFormPanel, type TransactionPaymentOption } from '../components/TransactionFormPanel'
import { formatDate, formatMoney } from '../utils/format'

function ledgerBalance(transactions: AccountTransaction[]): number {
  return transactions.reduce((sum, t) => {
    return sum + (t.entryType === 'debit' ? t.amount : -t.amount)
  }, 0)
}

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
    'inline-flex h-9 w-9 items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-teal-500/40'
  return tone === 'danger'
    ? `${base} text-red-700 hover:bg-red-50`
    : `${base} text-slate-700 hover:bg-slate-100`
}

export function AccountsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<AccountTransaction[]>([])
  const [paymentOptions, setPaymentOptions] = useState<TransactionPaymentOption[]>([])
  const [vendorName, setVendorName] = useState<Map<string, string>>(new Map())
  const [invoiceById, setInvoiceById] = useState<Map<string, Invoice>>(new Map())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showAddAccountPanel, setShowAddAccountPanel] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showTransactionPanel, setShowTransactionPanel] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<AccountTransaction | null>(null)

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<Account | null>(null)
  const [deleteAccountNameInput, setDeleteAccountNameInput] = useState('')
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false)

  const [deleteTransactionOpen, setDeleteTransactionOpen] = useState(false)
  const [deleteTransactionTarget, setDeleteTransactionTarget] = useState<AccountTransaction | null>(null)
  const [deleteTransactionAmountInput, setDeleteTransactionAmountInput] = useState('')
  const [deleteTransactionBusy, setDeleteTransactionBusy] = useState(false)

  const loadPaymentContext = useCallback(async (plist: Project[]) => {
    const opts: TransactionPaymentOption[] = []
    const vmap = new Map<string, string>()
    const imap = new Map<string, Invoice>()
    for (const p of plist) {
      const [pay, ven, inv] = await Promise.all([
        api.listPayments(p.id),
        api.listVendors(p.id),
        api.listInvoices(p.id),
      ])
      ven.forEach((v) => vmap.set(v.id, v.name))
      inv.forEach((i) => imap.set(i.id, i))
      pay.forEach((pm) =>
        opts.push({ payment: pm, projectId: p.id, projectName: p.name }),
      )
    }
    setPaymentOptions(opts)
    setVendorName(vmap)
    setInvoiceById(imap)
  }, [])

  const loadAccountsAndMeta = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
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
      await loadPaymentContext(plist)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load accounts.')
      setAccounts([])
      setBalances({})
    } finally {
      setLoading(false)
    }
  }, [loadPaymentContext])

  const loadTransactions = useCallback(async (aid: string) => {
    setErr(null)
    try {
      const txs = await api.listAccountTransactions(aid)
      setTransactions(txs)
      const bal = ledgerBalance(txs)
      setBalances((prev) => ({ ...prev, [aid]: bal }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load transactions.')
      setTransactions([])
    }
  }, [])

  useEffect(() => {
    void loadAccountsAndMeta()
  }, [loadAccountsAndMeta])

  useEffect(() => {
    if (!selectedAccountId) {
      setTransactions([])
      return
    }
    void loadTransactions(selectedAccountId)
  }, [selectedAccountId, loadTransactions])

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
                      await loadAccountsAndMeta()
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
                      await loadAccountsAndMeta()
                      await loadTransactions(selectedAccount.id)
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
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Project tag</th>
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
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
                        onClick={() => setSelectedAccountId(a.id)}
                      >
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
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
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
                <button
                  type="button"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                  onClick={() => {
                    setEditingTransaction(null)
                    setShowTransactionPanel(true)
                  }}
                >
                  Add transaction
                </button>
              </div>

              <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Entry</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Running balance</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Payment</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                          No transactions yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{formatDate(t.occurredOn)}</td>
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
                          <td className="px-3 py-2 text-slate-600">{t.description ?? '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {t.paymentId ? (
                              <span className="font-mono" title={t.paymentId}>
                                {t.paymentId.slice(0, 8)}…
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                className={iconBtnClass('neutral')}
                                aria-label="Edit transaction"
                                onClick={() => {
                                  setEditingTransaction(t)
                                  setShowTransactionPanel(true)
                                }}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
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
              onRefresh={loadAccountsAndMeta}
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
              key={editingTransaction?.id ?? 'new'}
              account={selectedAccount}
              projects={projects}
              paymentOptions={paymentOptions}
              vendorName={vendorName}
              invoiceById={invoiceById}
              editingTransaction={editingTransaction}
              onClose={() => {
                setShowTransactionPanel(false)
                setEditingTransaction(null)
              }}
              onSaved={async () => {
                await loadAccountsAndMeta()
                if (selectedAccountId) await loadTransactions(selectedAccountId)
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
