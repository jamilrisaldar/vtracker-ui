import type { AccountFixedDeposit } from '../../types'
import { MoneyInrShorthand } from '../MoneyInrShorthand'
import { formatDate } from '../../utils/format'
import { iconBtnClass, PencilIcon, TrashIcon } from './ledgerIcons'

export function FixedDepositsTable({
  rows,
  currency,
  onEdit,
  onDelete,
}: {
  rows: AccountFixedDeposit[]
  currency: string
  onEdit: (d: AccountFixedDeposit) => void
  onDelete: (d: AccountFixedDeposit) => void
}) {
  const totals = rows.reduce(
    (acc, r) => ({
      principal: acc.principal + r.principalAmount,
      maturity: acc.maturity + r.maturityValue,
      daily: acc.daily + r.dailyInterest,
      accrued: acc.accrued + r.accruedInterest,
    }),
    { principal: 0, maturity: 0, daily: 0, accrued: 0 },
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="w-10 whitespace-nowrap px-2 py-2">
              <span className="sr-only">Edit</span>
            </th>
            <th className="whitespace-nowrap px-3 py-2">Cert. #</th>
            <th className="whitespace-nowrap px-3 py-2">Effective</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Principal</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Rate</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Maturity value</th>
            <th className="whitespace-nowrap px-3 py-2">Maturity</th>
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
                No certificates yet. Use “Add certificate” to create one.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                className={[
                  r.status === 'cashed' ? 'bg-slate-100/80 text-slate-600' : 'bg-white',
                  'hover:bg-teal-50/30',
                ].join(' ')}
              >
                <td className="px-2 py-2 align-middle">
                  <button
                    type="button"
                    className={iconBtnClass('neutral')}
                    aria-label={`Edit certificate ${r.certificateNumber}`}
                    onClick={() => onEdit(r)}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
                  {r.certificateNumber}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDate(r.effectiveDate)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  <MoneyInrShorthand amount={r.principalAmount} currency={currency} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {r.annualRatePercent.toFixed(2)}%
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  <MoneyInrShorthand amount={r.maturityValue} currency={currency} />
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDate(r.maturityDate)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                  <MoneyInrShorthand amount={r.dailyInterest} currency={currency} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                  {r.daysElapsed}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                  <MoneyInrShorthand amount={r.accruedInterest} currency={currency} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 capitalize">{r.status}</td>
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
            ))
          )}
        </tbody>
        {rows.length > 0 ? (
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-medium">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-slate-700">
                Totals
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                <MoneyInrShorthand amount={totals.principal} currency={currency} />
              </td>
              <td className="px-3 py-2" />
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                <MoneyInrShorthand amount={totals.maturity} currency={currency} />
              </td>
              <td className="px-3 py-2" />
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
    </div>
  )
}
