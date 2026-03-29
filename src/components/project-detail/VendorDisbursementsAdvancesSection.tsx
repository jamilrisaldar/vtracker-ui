import { useCallback, useEffect, useState } from 'react'
import * as api from '../../api/dataApi'
import type { VendorAdvance } from '../../types'
import { formatDate, formatMoney } from '../../utils/format'

const iconBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

async function copyJson(label: string, data: unknown) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  } catch {
    window.prompt(`Copy ${label}`, JSON.stringify(data))
  }
}

/** Vendor prepayment pool (remaining balance). Contractor lump-sum batches are managed from each invoice. */
export function VendorDisbursementsAdvancesSection({
  projectId,
  vendorId,
  vendorName,
  onRefresh,
  onError,
  readOnly = false,
}: {
  projectId: string
  /** When set, only this vendor’s advances are listed. */
  vendorId?: string
  vendorName: Map<string, string>
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  readOnly?: boolean
}) {
  const [advances, setAdvances] = useState<VendorAdvance[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    onError(null)
    setLoading(true)
    try {
      const adv = await api.listVendorAdvances(projectId)
      setAdvances(vendorId ? adv.filter((a) => a.vendorId === vendorId) : adv)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not load vendor advances.')
    } finally {
      setLoading(false)
    }
  }, [projectId, vendorId, onError])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Prepayments to vendors (advance pool). Usages are applied when recording invoice payments.
        </p>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => void reload().then(() => onRefresh())}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
          >
            Refresh advances
          </button>
        ) : null}
      </div>
      {loading ? <p className="text-sm text-slate-600">Loading…</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-11 px-2 py-3">Actions</th>
              <th className="px-4 py-3">Paid</th>
              {!vendorId ? <th className="px-4 py-3">Vendor</th> : null}
              <th className="px-4 py-3">Advance</th>
              <th className="px-4 py-3">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {advances.length === 0 ? (
              <tr>
                <td
                  colSpan={vendorId ? 4 : 5}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No advances{vendorId ? ' for this vendor' : ''}. Create via API{' '}
                  <span className="font-mono text-xs">POST …/vendor-advances</span>.
                </td>
              </tr>
            ) : (
              advances.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      title="Copy advance JSON"
                      aria-label="Copy advance JSON"
                      className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                      onClick={() => void copyJson('advance', a)}
                    >
                      <CopyIcon />
                    </button>
                  </td>
                  <td className="px-4 py-2">{formatDate(a.paidDate)}</td>
                  {!vendorId ? (
                    <td className="px-4 py-2">{vendorName.get(a.vendorId) ?? a.vendorId}</td>
                  ) : null}
                  <td className="px-4 py-2">{formatMoney(a.amount, a.currency)}</td>
                  <td className="px-4 py-2">
                    {a.remainingBalance != null ? formatMoney(a.remainingBalance, a.currency) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
