import { formatMoney, formatMoneyInrShorthand, isInrShorthandCompressed } from '../utils/format'

type Props = {
  amount: number
  currency: string
  className?: string
}

/** INR L/CR shorthand with native hover tooltip showing full `formatMoney` when compressed. */
export function MoneyInrShorthand({ amount, currency, className }: Props) {
  const compressed = isInrShorthandCompressed(amount, currency)
  return (
    <span
      className={[className, compressed ? 'cursor-help' : undefined].filter(Boolean).join(' ')}
      title={compressed ? formatMoney(amount, currency) : undefined}
    >
      {formatMoneyInrShorthand(amount, currency)}
    </span>
  )
}
