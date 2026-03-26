import { useMemo } from 'react'
import type { AccountFixedDeposit, AccountFixedDepositStatus } from '../../types'
import {
  ACCOUNT_FIXED_DEPOSIT_STATUSES,
  ACCOUNT_FIXED_DEPOSIT_STATUS_LABELS,
} from '../../types'
import { MoneyInrShorthand } from '../MoneyInrShorthand'
import { fixedDepositMaturityHighlight } from '../../utils/fixedDepositMetrics'
import { formatDate } from '../../utils/format'
import { CopyIcon, iconBtnClass, PencilIcon, TrashIcon } from './ledgerIcons'

const fdTableActionsFirstColClass =
  'w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] whitespace-nowrap px-2 py-2'

function maturityRowClass(
  row: AccountFixedDeposit,
): { tr: string; maturityCell: string } {
  if (row.status !== 'active') {
    return {
      tr: 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/50',
      maturityCell: '',
    }
  }
  const tier = fixedDepositMaturityHighlight(row)
  if (tier === 'within30d') {
    return {
      tr: 'bg-emerald-800/18 text-slate-900 hover:bg-emerald-800/28',
      maturityCell: 'font-medium text-emerald-950',
    }
  }
  if (tier === 'within60d') {
    return {
      tr: 'bg-emerald-600/14 text-slate-900 hover:bg-emerald-600/24',
      maturityCell: 'font-medium text-emerald-900',
    }
  }
  if (tier === 'within90d') {
    return {
      tr: 'bg-emerald-400/14 text-slate-900 hover:bg-emerald-400/22',
      maturityCell: 'font-medium text-emerald-800',
    }
  }
  return {
    tr: 'bg-white hover:bg-teal-50/30',
    maturityCell: '',
  }
}

export function FixedDepositsTable({
  rows,
  summaryRows,
  currency,
  onEdit,
  onCopy,
  onDelete,
}: {
  rows: AccountFixedDeposit[]
  /** Full list for “totals by status”; defaults to `rows` if omitted. */
  summaryRows?: AccountFixedDeposit[]
  currency: string
  onEdit: (d: AccountFixedDeposit) => void
  onCopy: (d: AccountFixedDeposit) => void
  onDelete: (d: AccountFixedDeposit) => void
}) {
  const allForSummary = summaryRows ?? rows

  const totalsByStatus = useMemo(() => {
    const init: Record<
      AccountFixedDepositStatus,
      { count: number; principal: number; maturityValue: number; accrued: number }
    > = {
      active: { count: 0, principal: 0, maturityValue: 0, accrued: 0 },
      cashed_pre_maturity: { count: 0, principal: 0, maturityValue: 0, accrued: 0 },
      matured: { count: 0, principal: 0, maturityValue: 0, accrued: 0 },
      matured_rolled_over: { count: 0, principal: 0, maturityValue: 0, accrued: 0 },
    }
    for (const r of allForSummary) {
      const b = init[r.status as AccountFixedDepositStatus]
      if (!b) continue
      b.count += 1
      b.principal += r.principalAmount
      b.maturityValue += r.maturityValue
      b.accrued += r.accruedInterest
    }
    return init
  }, [allForSummary])

  const totals = rows.reduce(
    (acc, r) => ({
      principal: acc.principal + r.principalAmount,
      maturity: acc.maturity + r.maturityValue,
      daily: acc.daily + r.dailyInterest,
      accrued: acc.accrued + r.accruedInterest,
    }),
    { principal: 0, maturity: 0, daily: 0, accrued: 0 },
  )

  const filteredEmptyButHasData = rows.length === 0 && allForSummary.length > 0

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className={`${fdTableActionsFirstColClass} bg-slate-50`}>
              <span className="sr-only">Actions</span>
            </th>
            <th className="whitespace-nowrap px-3 py-2">Cert. #</th>
            <th className="whitespace-nowrap px-3 py-2">Effective</th>
            <th className="whitespace-nowrap px-3 py-2">Maturity date</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Principal</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Rate</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Maturity value</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Daily</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Days</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Accrued</th>
            <th className="whitespace-nowrap px-3 py-2">Status</th>
            <th className="min-w-[8rem] px-3 py-2">Notes</th>
            <th className="w-10 whitespace-nowrap px-2 py-2">
              <span className="sr-only">Delete</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-3 py-8 text-center text-slate-500">
                {filteredEmptyButHasData
                  ? 'No certificates match the selected status filters.'
                  : 'No certificates yet. Use “Add certificate” to create one.'}
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const { tr: trClass, maturityCell: maturityCellClass } = maturityRowClass(r)
              return (
              <tr key={r.id} className={trClass}>
                <td className={`${fdTableActionsFirstColClass} align-middle`}>
                  <div className="flex w-[5.5rem] shrink-0 flex-nowrap items-center gap-2">
                    <button
                      type="button"
                      className={iconBtnClass('neutral')}
                      aria-label={`Edit certificate ${r.certificateNumber}`}
                      onClick={() => onEdit(r)}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={iconBtnClass('neutral')}
                      aria-label={`Copy certificate ${r.certificateNumber} to new line`}
                      title="Copy to new certificate"
                      onClick={() => onCopy(r)}
                    >
                      <CopyIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
                  {r.certificateNumber}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDate(r.effectiveDate)}</td>
                <td
                  className={['whitespace-nowrap px-3 py-2', maturityCellClass].filter(Boolean).join(' ')}
                >
                  {formatDate(r.maturityDate)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  <MoneyInrShorthand amount={r.principalAmount} currency={currency} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {r.annualRatePercent.toFixed(2)}%
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  <MoneyInrShorthand amount={r.maturityValue} currency={currency} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                  <MoneyInrShorthand amount={r.dailyInterest} currency={currency} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                  {r.daysElapsed}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                  <MoneyInrShorthand amount={r.accruedInterest} currency={currency} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-800">
                  {ACCOUNT_FIXED_DEPOSIT_STATUS_LABELS[r.status] ?? r.status}
                </td>
                <td
                  className="max-w-[12rem] truncate px-3 py-2 text-slate-600"
                  title={r.notes ?? undefined}
                >
                  {r.notes?.trim() ? r.notes : '—'}
                </td>
                <td className="px-2 py-2 align-middle">
                  <button
                    type="button"
                    className={iconBtnClass('danger')}
                    aria-label={`Delete certificate ${r.certificateNumber}`}
                    onClick={() => onDelete(r)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
              )
            })
          )}
        </tbody>
        {rows.length > 0 ? (
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-medium">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-slate-700">
                Totals
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                <MoneyInrShorthand amount={totals.principal} currency={currency} />
              </td>
              <td className="px-3 py-2" />
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                <MoneyInrShorthand amount={totals.maturity} currency={currency} />
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                <MoneyInrShorthand amount={totals.daily} currency={currency} />
              </td>
              <td className="px-3 py-2" />
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                <MoneyInrShorthand amount={totals.accrued} currency={currency} />
              </td>
              <td colSpan={3} className="px-3 py-2" />
            </tr>
          </tfoot>
        ) : null}
      </table>

      {allForSummary.length > 0 ? (
        <div className="border-t border-slate-200 bg-slate-50/95 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Totals by status (all certificates)
          </p>
          <ul className="mt-2 space-y-2">
            {ACCOUNT_FIXED_DEPOSIT_STATUSES.map((st) => {
              const agg = totalsByStatus[st]
              if (agg.count === 0) return null
              return (
                <li
                  key={st}
                  className="flex flex-col gap-0.5 border-b border-slate-200/80 pb-2 last:border-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4"
                >
                  <span className="font-medium text-slate-800">
                    {ACCOUNT_FIXED_DEPOSIT_STATUS_LABELS[st]}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-slate-600 sm:text-sm">
                    <span>
                      {agg.count} {agg.count === 1 ? 'certificate' : 'certificates'}
                    </span>
                    <span className="tabular-nums">
                      Principal{' '}
                      <MoneyInrShorthand
                        amount={agg.principal}
                        currency={currency}
                        className="inline font-mono text-slate-800"
                      />
                    </span>
                    <span className="tabular-nums">
                      Maturity value{' '}
                      <MoneyInrShorthand
                        amount={agg.maturityValue}
                        currency={currency}
                        className="inline font-mono text-slate-800"
                      />
                    </span>
                    <span className="tabular-nums">
                      Accrued{' '}
                      <MoneyInrShorthand
                        amount={agg.accrued}
                        currency={currency}
                        className="inline font-mono text-slate-800"
                      />
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
