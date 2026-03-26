export function formatDate(iso: string): string {
  try {
    // Avoid off-by-one issues from `new Date("YYYY-MM-DD")` (treated as UTC midnight).
    // For date-only strings, construct a local Date instead.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d)
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

/**
 * Money string safe for jsPDF built-in fonts (Helvetica): they lack ₹, €, etc.
 * INR → `Rs.` + en-IN digits; other currencies → ISO code + amount (ASCII).
 */
export function formatMoneyForPdf(amount: number, currency: string): string {
  const c = currency.trim().toUpperCase()
  if (c === 'INR') {
    try {
      const num = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
      return `Rs. ${num}`
    } catch {
      return `Rs. ${amount}`
    }
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: c,
      currencyDisplay: 'code',
    }).format(amount)
  } catch {
    return `${amount} ${c}`
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
/** True when INR amount is shown as L/CR shorthand (≥ 1 lakh). */
export function isInrShorthandCompressed(amount: number, currency: string): boolean {
  if (currency.trim().toUpperCase() !== 'INR') return false
  return Math.abs(amount) >= INR_LAKH
}

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
