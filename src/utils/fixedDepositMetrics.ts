import type { AccountFixedDeposit, AccountFixedDepositStatus } from '../types'

export function parseIsoDateUtc(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b
}

export function wholeCalendarDaysBetween(startIso: string, endIso: string): number {
  const t0 = parseIsoDateUtc(startIso)
  const t1 = parseIsoDateUtc(endIso)
  if (Number.isNaN(t0) || Number.isNaN(t1) || t1 < t0) return 0
  return Math.floor((t1 - t0) / 86_400_000)
}

export function dailyInterestFromAnnual(principal: number, annualRatePercent: number): number {
  return (principal * (annualRatePercent / 100)) / 365
}

export function computeFixedDepositMetrics(input: {
  effectiveDate: string
  maturityDate: string
  principalAmount: number
  annualRatePercent: number
  status: AccountFixedDepositStatus
  asOfDate: string
}): { dailyInterest: number; daysElapsed: number; accruedInterest: number } {
  const dailyInterest = dailyInterestFromAnnual(input.principalAmount, input.annualRatePercent)
  const endAccrual =
    input.status === 'cashed_pre_maturity'
      ? input.maturityDate.trim()
      : minIsoDate(input.asOfDate.trim(), input.maturityDate.trim())
  const daysElapsed = wholeCalendarDaysBetween(input.effectiveDate.trim(), endAccrual)
  const accruedInterest = dailyInterest * daysElapsed
  return {
    dailyInterest: Math.round(dailyInterest * 1e4) / 1e4,
    daysElapsed,
    accruedInterest: Math.round(accruedInterest * 100) / 100,
  }
}

export function todayIsoDateUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Active FDs only; maturity must be today or later. Sooner maturity → darker highlight tier. */
export type FixedDepositMaturityHighlight = 'within30d' | 'within60d' | 'within90d'

export function fixedDepositMaturityHighlight(
  row: Pick<AccountFixedDeposit, 'maturityDate' | 'status'>,
  asOfIsoDate: string = todayIsoDateUtc(),
): FixedDepositMaturityHighlight | null {
  if (row.status !== 'active') return null
  const mat = row.maturityDate.trim()
  if (mat < asOfIsoDate) return null
  const d = wholeCalendarDaysBetween(asOfIsoDate.trim(), mat)
  if (d <= 30) return 'within30d'
  if (d <= 60) return 'within60d'
  if (d <= 90) return 'within90d'
  return null
}

export function enrichAccountFixedDeposit(
  row: Omit<AccountFixedDeposit, 'dailyInterest' | 'daysElapsed' | 'accruedInterest'>,
): AccountFixedDeposit {
  const metrics = computeFixedDepositMetrics({
    effectiveDate: row.effectiveDate,
    maturityDate: row.maturityDate,
    principalAmount: row.principalAmount,
    annualRatePercent: row.annualRatePercent,
    status: row.status,
    asOfDate: todayIsoDateUtc(),
  })
  return { ...row, ...metrics }
}
