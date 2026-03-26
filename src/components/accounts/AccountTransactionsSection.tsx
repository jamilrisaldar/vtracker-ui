import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import type {
  Account,
  AccountTransaction,
  AccountTransactionListFilters,
  Invoice,
  Project,
  TransactionPaymentOption,
} from '../../types'
import * as api from '../../api/dataApi'
import { MoneyInrShorthand } from '../MoneyInrShorthand'
import { TransactionFormPanel } from '../TransactionFormPanel'
import { CopyIcon, iconBtnClass, PencilIcon, TrashIcon } from './ledgerIcons'
import {
  exportAccountTransactionsExcel,
  exportAccountTransactionsPdf,
} from '../../utils/exportAccountTransactions'
import { formatDate, formatMoney } from '../../utils/format'

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

const tableActionsLastColClass =
  'w-[2.75rem] min-w-[2.75rem] max-w-[2.75rem] whitespace-nowrap px-2 py-3'
const txTableActionsFirstColClass =
  'w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] whitespace-nowrap px-2 py-2'
const txDescriptionColClass = 'w-[14rem] min-w-[14rem] max-w-[14rem]'

export function AccountTransactionsSection({
  account,
  projects,
  paymentOptions,
  vendorName,
  invoiceById,
  onAccountsRefresh,
  onError,
  embedded = false,
}: {
  account: Account
  projects: Project[]
  paymentOptions: TransactionPaymentOption[]
  vendorName: Map<string, string>
  invoiceById: Map<string, Invoice>
  onAccountsRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  /** When true, omit outer card chrome (used inside a parent tab panel). */
  embedded?: boolean
}) {
  const cachedTransactions = useAppSelector(
    (s) => s.accountsPage.transactionsByAccountId[account.id],
  )
  const [filteredTransactions, setFilteredTransactions] = useState<AccountTransaction[]>([])
  const [showTransactionPanel, setShowTransactionPanel] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<AccountTransaction | null>(null)
  const [copyTemplateTransaction, setCopyTemplateTransaction] = useState<AccountTransaction | null>(
    null,
  )
  const [txPanelSeq, setTxPanelSeq] = useState(0)

  const [deleteTransactionOpen, setDeleteTransactionOpen] = useState(false)
  const [deleteTransactionTarget, setDeleteTransactionTarget] = useState<AccountTransaction | null>(
    null,
  )
  const [deleteTransactionAmountInput, setDeleteTransactionAmountInput] = useState('')
  const [deleteTransactionBusy, setDeleteTransactionBusy] = useState(false)

  const [txFilterDraft, setTxFilterDraft] = useState(emptyTxFilterDraft)
  const [txFilterApplied, setTxFilterApplied] = useState<AccountTransactionListFilters>({})
  const [txFiltersVisible, setTxFiltersVisible] = useState(false)

  const loadFilteredTransactions = useCallback(
    async (aid: string, filters: AccountTransactionListFilters) => {
      onError(null)
      try {
        const txs = await api.listAccountTransactions(aid, filters)
        setFilteredTransactions(txs)
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Failed to load transactions.')
        setFilteredTransactions([])
      }
    },
    [onError],
  )

  const applyTransactionFilters = () => {
    const from = txFilterDraft.occurredOnFrom.trim()
    const to = txFilterDraft.occurredOnTo.trim()
    if (from && to && from > to) {
      onError('Date from must be on or before date to.')
      return
    }
    onError(null)
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
    onError(null)
    setTxFilterDraft(emptyTxFilterDraft())
    setTxFilterApplied({})
  }

  const hasActiveTransactionFilters = Object.keys(txFilterApplied).length > 0

  useEffect(() => {
    if (!hasActiveTransactionFilters) {
      setFilteredTransactions([])
      return
    }
    void loadFilteredTransactions(account.id, txFilterApplied)
  }, [account.id, hasActiveTransactionFilters, loadFilteredTransactions, txFilterApplied])

  const transactions = hasActiveTransactionFilters
    ? filteredTransactions
    : (cachedTransactions ?? [])

  const deleteTransactionExpectedAmount = deleteTransactionTarget
    ? canonicalAmountString(deleteTransactionTarget.amount)
    : ''
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
    <>
      {deleteTransactionOpen && deleteTransactionTarget ? (
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
              Type the numeric amount below exactly as shown in the confirmation field (no currency
              symbols).
            </p>
            <p className="mt-2 text-right text-sm font-medium text-slate-800">
              <MoneyInrShorthand
                amount={deleteTransactionTarget.amount}
                currency={account.currency}
              />
            </p>
            <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-right font-mono text-sm font-medium text-slate-900">
              {deleteTransactionExpectedAmount} ({account.currency})
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Transaction amount</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"
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
                  if (!deleteTransactionCanSubmit || !deleteTransactionTarget) return
                  setDeleteTransactionBusy(true)
                  onError(null)
                  void (async () => {
                    try {
                      await api.deleteAccountTransaction(deleteTransactionTarget.id, account.id)
                      await onAccountsRefresh()
                      if (Object.keys(txFilterApplied).length > 0) {
                        await loadFilteredTransactions(account.id, txFilterApplied)
                      }
                      setDeleteTransactionOpen(false)
                      setDeleteTransactionTarget(null)
                      setDeleteTransactionAmountInput('')
                      setDeleteTransactionBusy(false)
                    } catch (er) {
                      onError(er instanceof Error ? er.message : 'Delete failed.')
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

      <section
        className={
          embedded
            ? 'p-6 pt-5'
            : 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">Transactions — {account.name}</h2>
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
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              onClick={() => {
                onError(null)
                try {
                  exportAccountTransactionsPdf(
                    account,
                    transactions,
                    projectNameById,
                    txFilterApplied,
                  )
                } catch (e) {
                  onError(e instanceof Error ? e.message : 'PDF export failed.')
                }
              }}
            >
              Export PDF
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              onClick={() => {
                onError(null)
                try {
                  exportAccountTransactionsExcel(
                    account,
                    transactions,
                    projectNameById,
                    txFilterApplied,
                  )
                } catch (e) {
                  onError(e instanceof Error ? e.message : 'Excel export failed.')
                }
              }}
            >
              Export Excel
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
                    setTxFilterDraft((d) => ({
                      ...d,
                      transactionCategoryContains: e.target.value,
                    }))
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
                <th className="whitespace-nowrap px-3 py-2 text-right tabular-nums">Amount</th>
                <th className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  Running balance
                </th>
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
                    <td className="px-3 py-2 text-right">
                      <MoneyInrShorthand
                        amount={t.amount}
                        currency={account.currency}
                        className={[
                          'font-mono tabular-nums',
                          t.entryType === 'debit' ? 'text-emerald-700' : 'text-red-700',
                        ].join(' ')}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">
                      {t.runningBalance == null ? (
                        '—'
                      ) : (
                        <MoneyInrShorthand
                          amount={t.runningBalance}
                          currency={account.currency}
                          className="font-mono tabular-nums text-slate-800"
                        />
                      )}
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
                    <td
                      className="max-w-[10rem] truncate px-3 py-2 text-xs text-slate-600"
                      title={t.transactionCategory ?? undefined}
                    >
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
                          aria-label={`Remove transaction ${formatMoney(t.amount, account.currency)}`}
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

      {showTransactionPanel ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            <TransactionFormPanel
              key={`${editingTransaction?.id ?? 'new'}-${copyTemplateTransaction?.id ?? ''}-${txPanelSeq}`}
              account={account}
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
                await onAccountsRefresh()
                if (Object.keys(txFilterApplied).length > 0) {
                  await loadFilteredTransactions(account.id, txFilterApplied)
                }
              }}
              onError={onError}
              className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
