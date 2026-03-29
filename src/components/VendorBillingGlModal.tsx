import type { GeneralLedgerEntry } from '../types'
import { formatDate, formatMoney } from '../utils/format'

const iconBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

export type VendorBillingGlSection = {
  title: string
  subtitle?: string
  entries: GeneralLedgerEntry[]
}

function LedgerIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  )
}

export function VendorBillingGlIconButton({
  onClick,
  disabled = false,
  label = 'View GL entries',
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`${iconBtnClass} text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
      onClick={onClick}
    >
      <LedgerIcon />
    </button>
  )
}

function GlEntriesTable({ entries }: { entries: GeneralLedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-3 text-sm text-slate-500">No general ledger lines for this source.</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-2 py-2">Date</th>
            <th className="px-2 py-2">Account</th>
            <th className="px-2 py-2">Debit</th>
            <th className="px-2 py-2">Credit</th>
            <th className="px-2 py-2">Memo</th>
            <th className="px-2 py-2">Notes</th>
            <th className="px-2 py-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="whitespace-nowrap px-2 py-1.5">{formatDate(r.entryDate)}</td>
              <td className="px-2 py-1.5">
                <span className="font-mono text-xs">{r.accountCode}</span> {r.accountName}
              </td>
              <td className="px-2 py-1.5">{r.debit > 0 ? formatMoney(r.debit) : '—'}</td>
              <td className="px-2 py-1.5">{r.credit > 0 ? formatMoney(r.credit) : '—'}</td>
              <td className="max-w-[10rem] px-2 py-1.5 text-xs text-slate-600">{r.memo ?? '—'}</td>
              <td className="max-w-[10rem] px-2 py-1.5 text-xs text-slate-600">{r.userNotes?.trim() ? r.userNotes : '—'}</td>
              <td className="px-2 py-1.5 text-xs text-slate-600">
                <span className="break-all">{r.sourceKind}</span>
                <br />
                <span className="font-mono">{r.sourceId.slice(0, 8)}…</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function VendorBillingGlModal({
  open,
  title,
  sections,
  loading,
  error,
  onClose,
}: {
  open: boolean
  title: string
  sections: VendorBillingGlSection[]
  loading: boolean
  error: string | null
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-billing-gl-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[min(90vh,720px)] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 id="vendor-billing-gl-modal-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="max-h-[min(78vh,640px)] overflow-y-auto px-4 py-4">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
          ) : null}
          {loading ? <p className="text-sm text-slate-600">Loading…</p> : null}
          {!loading && !error ? (
            <div className="space-y-8">
              {sections.map((sec, idx) => (
                <div key={`${sec.title}-${idx}`}>
                  <h3 className="text-sm font-medium text-slate-900">{sec.title}</h3>
                  {sec.subtitle ? <p className="mt-0.5 text-xs text-slate-600">{sec.subtitle}</p> : null}
                  <div className="mt-2">
                    <GlEntriesTable entries={sec.entries} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
