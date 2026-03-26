import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Account, Invoice } from '../types'
import * as api from '../api/dataApi'
import { AccountAddPanel } from '../components/AccountAddPanel'
import { AccountsSummaryReport } from '../components/accounts/AccountsSummaryReport'
import { AccountFixedDepositsPanel } from '../components/accounts/AccountFixedDepositsPanel'
import { AccountTransactionsSection } from '../components/accounts/AccountTransactionsSection'
import { PencilIcon, TrashIcon, iconBtnClass } from '../components/accounts/ledgerIcons'
import { MoneyInrShorthand } from '../components/MoneyInrShorthand'
import { bootstrapAccountsPage } from '../store/slices/accountsPageSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

/** Fixed columns: primary actions (first col), delete only (last col); icons must not wrap. */
const tableActionsFirstColClass = 'w-[2.75rem] min-w-[2.75rem] max-w-[2.75rem] whitespace-nowrap px-2 py-3'
const tableActionsLastColClass = 'w-[2.75rem] min-w-[2.75rem] max-w-[2.75rem] whitespace-nowrap px-2 py-3'

type AccountDetailTab = 'transactions' | 'fixedDeposits'

export function AccountsPage() {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector((s) => s.accountsPage.accounts)
  const projects = useAppSelector((s) => s.accountsPage.projects)
  const balancesByAccountId = useAppSelector((s) => s.accountsPage.balancesByAccountId)
  const bootstrapStatus = useAppSelector((s) => s.accountsPage.bootstrapStatus)
  const bootstrapError = useAppSelector((s) => s.accountsPage.bootstrapError)
  const paymentOptions = useAppSelector((s) => s.accountsPage.paymentOptions)
  const vendorByIdRecord = useAppSelector((s) => s.accountsPage.vendorById)
  const invoiceByIdRecord = useAppSelector((s) => s.accountsPage.invoiceById)

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [accountDetailTab, setAccountDetailTab] = useState<AccountDetailTab>('transactions')
  const [err, setErr] = useState<string | null>(null)
  const [showAddAccountPanel, setShowAddAccountPanel] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<Account | null>(null)
  const [deleteAccountNameInput, setDeleteAccountNameInput] = useState('')
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false)

  const [showAccountsReport, setShowAccountsReport] = useState(false)

  const refreshAccountsData = useCallback(async () => {
    setErr(null)
    try {
      await dispatch(bootstrapAccountsPage()).unwrap()
    } catch (e) {
      setErr(
        typeof e === 'string' ? e : e instanceof Error ? e.message : 'Failed to refresh accounts.',
      )
    }
  }, [dispatch])

  useEffect(() => {
    setErr(null)
    void dispatch(bootstrapAccountsPage())
  }, [dispatch])

  useEffect(() => {
    setAccountDetailTab('transactions')
  }, [selectedAccountId])

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const deleteAccountNameOk =
    !!deleteAccountTarget && deleteAccountNameInput.trim() === deleteAccountTarget.name
  const deleteAccountCanSubmit = deleteAccountNameOk && !deleteAccountBusy

  const displayErr = err ?? bootstrapError
  const loading = bootstrapStatus === 'loading'

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
              This will permanently remove this account, its ledger transactions, and any fixed
              deposit certificates linked to it. This cannot be undone.
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
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            aria-expanded={showAccountsReport}
            onClick={() => setShowAccountsReport((v) => !v)}
          >
            {showAccountsReport ? 'Hide report' : 'Report'}
          </button>
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

      {displayErr && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {displayErr}
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
                    <th className="px-4 py-3 text-right tabular-nums">Balance</th>
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
                        onClick={() => setSelectedAccountId(a.id)}
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
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                          <MoneyInrShorthand
                            amount={balancesByAccountId[a.id] ?? 0}
                            currency={a.currency}
                            className="font-mono tabular-nums"
                          />
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

            <AccountsSummaryReport
              visible={showAccountsReport}
              accounts={accounts}
              balancesByAccountId={balancesByAccountId}
            />
          </section>

          {selectedAccount ? (
            <section
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              aria-label={`Account detail: ${selectedAccount.name}`}
            >
              <div
                className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-2 pt-2"
                role="tablist"
                aria-label="Account sections"
              >
                <button
                  type="button"
                  role="tab"
                  id="account-tab-transactions"
                  aria-selected={accountDetailTab === 'transactions'}
                  aria-controls="account-panel-transactions"
                  tabIndex={accountDetailTab === 'transactions' ? 0 : -1}
                  className={[
                    'rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    accountDetailTab === 'transactions'
                      ? 'border border-b-0 border-slate-200 bg-white text-teal-800'
                      : 'border border-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
                  ].join(' ')}
                  onClick={() => setAccountDetailTab('transactions')}
                >
                  Transactions
                </button>
                <button
                  type="button"
                  role="tab"
                  id="account-tab-fixed-deposits"
                  aria-selected={accountDetailTab === 'fixedDeposits'}
                  aria-controls="account-panel-fixed-deposits"
                  tabIndex={accountDetailTab === 'fixedDeposits' ? 0 : -1}
                  className={[
                    'rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    accountDetailTab === 'fixedDeposits'
                      ? 'border border-b-0 border-slate-200 bg-white text-teal-800'
                      : 'border border-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
                  ].join(' ')}
                  onClick={() => setAccountDetailTab('fixedDeposits')}
                >
                  Fixed deposits &amp; certificates
                </button>
              </div>
              <div
                id="account-panel-transactions"
                role="tabpanel"
                aria-labelledby="account-tab-transactions"
                hidden={accountDetailTab !== 'transactions'}
              >
                <AccountTransactionsSection
                  key={selectedAccount.id}
                  embedded
                  account={selectedAccount}
                  projects={projects}
                  paymentOptions={paymentOptions}
                  vendorName={vendorName}
                  invoiceById={invoiceById}
                  onAccountsRefresh={refreshAccountsData}
                  onError={setErr}
                />
              </div>
              <div
                id="account-panel-fixed-deposits"
                role="tabpanel"
                aria-labelledby="account-tab-fixed-deposits"
                hidden={accountDetailTab !== 'fixedDeposits'}
              >
                <AccountFixedDepositsPanel
                  key={selectedAccount.id}
                  account={selectedAccount}
                  onError={setErr}
                  active={accountDetailTab === 'fixedDeposits'}
                />
              </div>
            </section>
          ) : null}
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
    </div>
  )
}
