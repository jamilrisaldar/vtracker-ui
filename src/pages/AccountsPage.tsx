import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  Account,
  AccountTransaction,
  Invoice,
  Payment,
  Project,
} from '../types'
import * as api from '../api/dataApi'
import { AccountAddPanel } from '../components/AccountAddPanel'
import { formatDate, formatMoney } from '../utils/format'

function ledgerBalance(transactions: AccountTransaction[]): number {
  return transactions.reduce((sum, t) => {
    return sum + (t.entryType === 'debit' ? t.amount : -t.amount)
  }, 0)
}

type PaymentOption = { payment: Payment; projectId: string; projectName: string }

export function AccountsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<AccountTransaction[]>([])
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([])
  const [vendorName, setVendorName] = useState<Map<string, string>>(new Map())
  const [invoiceById, setInvoiceById] = useState<Map<string, Invoice>>(new Map())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showAddAccountPanel, setShowAddAccountPanel] = useState(false)

  const [txAmount, setTxAmount] = useState('')
  const [txEntry, setTxEntry] = useState<'debit' | 'credit'>('debit')
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [txDesc, setTxDesc] = useState('')
  const [txPaymentId, setTxPaymentId] = useState('')
  const [txProjectId, setTxProjectId] = useState('')

  const loadPaymentContext = useCallback(async (plist: Project[]) => {
    const opts: PaymentOption[] = []
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

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>()
    projects.forEach((p) => m.set(p.id, p.name))
    return m
  }, [projects])

  return (
    <div className="mx-auto max-w-6xl">
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
            onClick={() => setShowAddAccountPanel(true)}
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
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!confirm('Delete this account and all its transactions?')) return
                              void (async () => {
                                try {
                                  await api.deleteAccount(a.id)
                                  if (selectedAccountId === a.id) setSelectedAccountId(null)
                                  await loadAccountsAndMeta()
                                } catch (er) {
                                  setErr(er instanceof Error ? er.message : 'Delete failed.')
                                }
                              })()
                            }}
                          >
                            Remove
                          </button>
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
              <h2 className="text-lg font-medium text-slate-900">
                Transactions — {selectedAccount.name}
              </h2>

              <form
                className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!txAmount || !selectedAccountId) return
                  setErr(null)
                  try {
                    await api.createAccountTransaction({
                      accountId: selectedAccountId,
                      amount: Number(txAmount),
                      entryType: txEntry,
                      occurredOn: txDate,
                      description: txDesc || undefined,
                      paymentId: txPaymentId || undefined,
                      projectId: txPaymentId ? undefined : txProjectId || undefined,
                    })
                    setTxAmount('')
                    setTxDesc('')
                    setTxPaymentId('')
                    setTxProjectId('')
                    await loadAccountsAndMeta()
                    await loadTransactions(selectedAccountId)
                  } catch (er) {
                    setErr(er instanceof Error ? er.message : 'Could not save transaction.')
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
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Entry</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={txEntry}
                    onChange={(e) => setTxEntry(e.target.value as 'debit' | 'credit')}
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Date</span>
                  <input
                    required
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium text-slate-600">
                    Project tag (optional, ignored if a payment is linked)
                  </span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={txProjectId}
                    onChange={(e) => setTxProjectId(e.target.value)}
                    disabled={Boolean(txPaymentId)}
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
                    value={txPaymentId}
                    onChange={(e) => {
                      setTxPaymentId(e.target.value)
                      if (e.target.value) setTxProjectId('')
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
                <label className="block sm:col-span-2 lg:col-span-3">
                  <span className="text-xs font-medium text-slate-600">Description (optional)</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={txDesc}
                    onChange={(e) => setTxDesc(e.target.value)}
                  />
                </label>
                <div className="sm:col-span-2 lg:col-span-3">
                  <button
                    type="submit"
                    className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                  >
                    Add transaction
                  </button>
                </div>
              </form>

              <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Entry</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Payment</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                          No transactions yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{formatDate(t.occurredOn)}</td>
                          <td className="px-3 py-2 capitalize">{t.entryType}</td>
                          <td className="px-3 py-2 font-mono">
                            {formatMoney(t.amount, selectedAccount.currency)}
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
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline"
                              onClick={() => {
                                if (!confirm('Remove this transaction?')) return
                                void (async () => {
                                  try {
                                    await api.deleteAccountTransaction(t.id, selectedAccount.id)
                                    await loadAccountsAndMeta()
                                    await loadTransactions(selectedAccount.id)
                                  } catch (er) {
                                    setErr(er instanceof Error ? er.message : 'Delete failed.')
                                  }
                                })()
                              }}
                            >
                              Remove
                            </button>
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
              onClose={() => setShowAddAccountPanel(false)}
              onRefresh={loadAccountsAndMeta}
              onError={setErr}
              className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
