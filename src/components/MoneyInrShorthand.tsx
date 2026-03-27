import { formatMoney, formatMoneyInrShorthand, isInrShorthandCompressed } from '../utils/format'

type Props = {
  amount: number | null | undefined
  currency?: string
  className?: string
}

/**
 * INR: lakhs / crores shorthand when |amount| ≥ 1L; other currencies use full `formatMoney`.
 * Hover (`title`) always shows the full formatted value for quick reference.
 */
export function MoneyInrShorthand({ amount, currency = 'INR', className }: Props) {
  if (amount == null || Number.isNaN(amount)) {
    return <span className={className}>—</span>
  }
  const cur = currency.trim() || 'INR'
  const compressed = isInrShorthandCompressed(amount, cur)
  const full = formatMoney(amount, cur)
  return (
    <span
      className={[className, compressed ? 'cursor-help' : undefined].filter(Boolean).join(' ')}
      title={full}
    >
      {formatMoneyInrShorthand(amount, cur)}
    </span>
  )
}
