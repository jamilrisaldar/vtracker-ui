import { useEffect, useMemo, useRef, useState } from 'react'
import type { Account } from '../../types'
import * as api from '../../api/dataApi'
import { MoneyInrShorthand } from '../MoneyInrShorthand'

export function AccountsSummaryReport({
  visible,
  accounts,
  balancesByAccountId,
}: {
  visible: boolean
  accounts: Account[]
  balancesByAccountId: Record<string, number>
}) {
  const [fdLoading, setFdLoading] = useState(false)
  const [fdError, setFdError] = useState<string | null>(null)
  const [fdTotals, setFdTotals] = useState<Record<string, { principal: number; count: number }>>(
    {},
  )

  const cashTotalsByCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of accounts) {
      const c = (a.currency ?? 'INR').trim().toUpperCase() || 'INR'
      m.set(c, (m.get(c) ?? 0) + (balancesByAccountId[a.id] ?? 0))
    }
    return [...m.entries()].sort(([x], [y]) => x.localeCompare(y))
  }, [accounts, balancesByAccountId])

  const accountsReportKey = useMemo(
    () =>
      [...accounts]
        .map((a) => `${a.id}:${(a.currency ?? 'INR').trim().toUpperCase()}`)
        .sort()
        .join('|'),
    [accounts],
  )

  const fetchGen = useRef(0)
  useEffect(() => {
    if (!visible) return
    if (accounts.length === 0) {
      setFdTotals({})
      setFdLoading(false)
      setFdError(null)
      return
    }
    const gen = ++fetchGen.current
    setFdLoading(true)
    setFdError(null)
    void (async () => {
      try {
        const lists = await Promise.all(accounts.map((a) => api.listAccountFixedDeposits(a.id)))
        if (gen !== fetchGen.current) return
        const next: Record<string, { principal: number; count: number }> = {}
        lists.forEach((list, i) => {
          const acc = accounts[i]
          const curr = (acc?.currency ?? 'INR').trim().toUpperCase() || 'INR'
          if (!next[curr]) next[curr] = { principal: 0, count: 0 }
          for (const fd of list) {
            next[curr].principal += fd.principalAmount
            next[curr].count += 1
          }
        })
        setFdTotals(next)
      } catch (e) {
        if (gen !== fetchGen.current) return
        setFdError(e instanceof Error ? e.message : 'Failed to load fixed deposits.')
        setFdTotals({})
      } finally {
        if (gen === fetchGen.current) setFdLoading(false)
      }
    })()
  }, [visible, accountsReportKey, accounts])

  const currencyRows = useMemo(() => {
    const keys = new Set<string>()
    cashTotalsByCurrency.forEach(([c]) => keys.add(c))
    Object.keys(fdTotals).forEach((c) => keys.add(c))
    return [...keys].sort((a, b) => a.localeCompare(b))
  }, [cashTotalsByCurrency, fdTotals])

  if (!visible) return null

  return (
    <div
      className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
      role="region"
      aria-label="Accounts financial summary"
    >
      <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
      <p className="mt-1 text-xs text-slate-600">
        Ledger cash vs principal locked in fixed deposits (per currency).
      </p>
      {accounts.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Add accounts to see totals.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {fdLoading ? (
            <p className="text-sm text-slate-600">Loading fixed deposit totals…</p>
          ) : null}
          {fdError ? <p className="text-sm text-red-700">{fdError}</p> : null}
          {currencyRows.map((curr) => {
            const cash = cashTotalsByCurrency.find(([c]) => c === curr)?.[1] ?? 0
            const fd = fdTotals[curr] ?? { principal: 0, count: 0 }
            const combined = cash + fd.principal
            return (
              <div
                key={curr}
                className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {curr}
                </p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-slate-500">Cash (ledger balance)</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                      <MoneyInrShorthand
                        amount={cash}
                        currency={curr}
                        className="font-mono tabular-nums"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Fixed deposits (principal)</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                      <MoneyInrShorthand
                        amount={fd.principal}
                        currency={curr}
                        className="font-mono tabular-nums"
                      />
                    </dd>
                    <dd className="mt-1 text-xs text-slate-500">
                      {fd.count === 0
                        ? 'No certificates'
                        : `${fd.count} certificate${fd.count === 1 ? '' : 's'}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Cash + FD principal</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-teal-900">
                      <MoneyInrShorthand
                        amount={combined}
                        currency={curr}
                        className="font-mono tabular-nums text-teal-900"
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
