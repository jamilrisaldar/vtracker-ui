import { formatMoney, formatMoneyDisplayShort } from '../utils/format'

/** Table/summary money: compact display with native tooltip showing full formatted amount. */
export function MoneyAmount({
  amount,
  currency = 'INR',
  className = '',
}: {
  amount: number
  currency?: string
  className?: string
}) {
  const full = formatMoney(amount, currency)
  const short = formatMoneyDisplayShort(amount, currency)
  return (
    <span className={['tabular-nums', className].filter(Boolean).join(' ')} title={full}>
      {short}
    </span>
  )
}
