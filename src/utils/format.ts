export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
}

export function formatMoney(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

const INR_LAKH = 100_000
const INR_CRORE = 10_000_000

function trimUpToTwoDecimals(n: number): string {
  const r = Math.round(n * 100) / 100
  if (Number.isInteger(r)) return String(r)
  const s = r.toFixed(2)
  return s.replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * For INR: use ₹ with L (lakhs) or CR (crores) when |amount| ≥ 1 lakh or 1 crore;
 * otherwise en-IN currency format. Other currencies use `formatMoney`.
 */
export function formatMoneyInrShorthand(amount: number, currency: string): string {
  const c = currency.trim().toUpperCase()
  if (c !== 'INR') {
    return formatMoney(amount, currency)
  }
  const sign = amount < 0 ? '-' : ''
  const a = Math.abs(amount)
  if (a >= INR_CRORE) {
    return `${sign}₹${trimUpToTwoDecimals(a / INR_CRORE)} CR`
  }
  if (a >= INR_LAKH) {
    return `${sign}₹${trimUpToTwoDecimals(a / INR_LAKH)} L`
  }
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${sign}₹${amount}`
  }
}
