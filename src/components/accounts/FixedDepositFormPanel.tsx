import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { AccountFixedDeposit, AccountFixedDepositStatus } from '../../types'

const statusOptions: { value: AccountFixedDepositStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'cashed_pre_maturity', label: 'Cashed - Pre-maturity' },
  { value: 'matured', label: 'Matured' },
  { value: 'matured_rolled_over', label: 'Matured - Rolled over' },
]

function parseMoney(s: string): number {
  const t = s.trim()
  if (t === '') throw new Error('Required amount')
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) throw new Error('Amount must be a non-negative number')
  return n
}

function parseRate(s: string): number {
  const t = s.trim()
  if (t === '') throw new Error('Required rate')
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Rate must be between 0 and 100')
  return n
}

export function FixedDepositFormPanel({
  mode,
  accountId,
  deposit,
  templateForNew,
  onClose,
  onSaved,
  onError,
  className,
}: {
  mode: 'add' | 'edit'
  accountId: string
  deposit?: AccountFixedDeposit
  /** When adding, pre-fill from an existing row (certificate # left blank). */
  templateForNew?: AccountFixedDeposit | null
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const initial = useMemo(() => {
    if (mode === 'edit' && deposit) {
      return {
        certificateNumber: deposit.certificateNumber,
        effectiveDate: deposit.effectiveDate,
        principalStr: String(deposit.principalAmount),
        rateStr: String(deposit.annualRatePercent),
        maturityValueStr: String(deposit.maturityValue),
        maturityDate: deposit.maturityDate,
        status: deposit.status,
        notes: deposit.notes ?? '',
      }
    }
    if (mode === 'add' && templateForNew) {
      const t = templateForNew
      return {
        certificateNumber: '',
        effectiveDate: t.effectiveDate,
        principalStr: String(t.principalAmount),
        rateStr: String(t.annualRatePercent),
        maturityValueStr: String(t.maturityValue),
        maturityDate: t.maturityDate,
        status: 'active' as AccountFixedDepositStatus,
        notes: t.notes ?? '',
      }
    }
    return {
      certificateNumber: '',
      effectiveDate: '',
      principalStr: '',
      rateStr: '',
      maturityValueStr: '',
      maturityDate: '',
      status: 'active' as AccountFixedDepositStatus,
      notes: '',
    }
  }, [mode, deposit, templateForNew])

  const [certificateNumber, setCertificateNumber] = useState(initial.certificateNumber)
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate)
  const [principalStr, setPrincipalStr] = useState(initial.principalStr)
  const [rateStr, setRateStr] = useState(initial.rateStr)
  const [maturityValueStr, setMaturityValueStr] = useState(initial.maturityValueStr)
  const [maturityDate, setMaturityDate] = useState(initial.maturityDate)
  const [status, setStatus] = useState<AccountFixedDepositStatus>(initial.status)
  const [notes, setNotes] = useState(initial.notes)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCertificateNumber(initial.certificateNumber)
    setEffectiveDate(initial.effectiveDate)
    setPrincipalStr(initial.principalStr)
    setRateStr(initial.rateStr)
    setMaturityValueStr(initial.maturityValueStr)
    setMaturityDate(initial.maturityDate)
    setStatus(initial.status)
    setNotes(initial.notes)
  }, [initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!certificateNumber.trim() || !effectiveDate || !maturityDate) return
    onError(null)
    let principalAmount: number
    let annualRatePercent: number
    let maturityValue: number
    try {
      principalAmount = parseMoney(principalStr)
      annualRatePercent = parseRate(rateStr)
      maturityValue = parseMoney(maturityValueStr)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Invalid number')
      return
    }
    if (maturityDate < effectiveDate) {
      onError('Maturity date must be on or after effective date.')
      return
    }
    setSaving(true)
    try {
      if (mode === 'add') {
        await api.createAccountFixedDeposit({
          accountId,
          certificateNumber,
          effectiveDate,
          principalAmount,
          annualRatePercent,
          maturityValue,
          maturityDate,
          status,
          notes: notes.trim() || undefined,
        })
      } else {
        if (!deposit) throw new Error('Missing certificate')
        await api.updateAccountFixedDeposit(deposit.id, accountId, {
          certificateNumber,
          effectiveDate,
          principalAmount,
          annualRatePercent,
          maturityValue,
          maturityDate,
          status,
          notes: notes.trim() || null,
        })
      }
      await onSaved()
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={['rounded-none border border-slate-200 bg-white p-6 shadow-xl', className]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="text-lg font-medium text-slate-900">
        {mode === 'add'
          ? templateForNew
            ? 'Add certificate (from copy)'
            : 'Add certificate'
          : 'Edit certificate'}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Daily interest and accrued amounts use simple interest (annual rate ÷ 365) and update when you
        reload this list.
      </p>

      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => void handleSubmit(e)}>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Certificate #</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={certificateNumber}
            onChange={(e) => setCertificateNumber(e.target.value)}
            placeholder="e.g. 288"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Effective date</span>
          <input
            required
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Maturity date</span>
          <input
            required
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={maturityDate}
            onChange={(e) => setMaturityDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Principal amount</span>
          <input
            required
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            value={principalStr}
            onChange={(e) => setPrincipalStr(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Annual rate (%)</span>
          <input
            required
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            value={rateStr}
            onChange={(e) => setRateStr(e.target.value)}
            placeholder="10"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Maturity value</span>
          <input
            required
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            value={maturityValueStr}
            onChange={(e) => setMaturityValueStr(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Status</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as AccountFixedDepositStatus)}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Notes (optional)</span>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : mode === 'add' ? 'Add certificate' : 'Save changes'}
          </button>
          <button
            type="button"
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={() => onClose()}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
