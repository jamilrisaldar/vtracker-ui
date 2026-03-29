import { useCallback, useEffect, useState } from 'react'
import * as api from '../../api/dataApi'
import type { Vendor, VendorAdvance } from '../../types'
import { formatDate } from '../../utils/format'
import { MoneyAmount } from '../MoneyAmount'
import { VendorAdvanceRecordPanel } from '../VendorAdvanceRecordPanel'
import { VendorBillingGlIconButton, VendorBillingGlModal, type VendorBillingGlSection } from '../VendorBillingGlModal'
import { GL_SOURCE_KINDS } from '../../utils/glSourceKinds'

const iconBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

/** Vendor prepayment pool (remaining balance). Contractor lump-sum batches are managed from each invoice or when recording payments. */
export function VendorDisbursementsAdvancesSection({
  projectId,
  vendorId,
  vendors,
  vendorName,
  onRefresh,
  onError,
  readOnly = false,
}: {
  projectId: string
  /** When set, only this vendor’s advances are listed. */
  vendorId?: string
  vendors: Vendor[]
  vendorName: Map<string, string>
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  readOnly?: boolean
}) {
  const [advances, setAdvances] = useState<VendorAdvance[]>([])
  const [loading, setLoading] = useState(true)
  const [panelAdvance, setPanelAdvance] = useState<VendorAdvance | 'new' | null>(null)
  const [glModalOpen, setGlModalOpen] = useState(false)
  const [glModalTitle, setGlModalTitle] = useState('')
  const [glModalSections, setGlModalSections] = useState<VendorBillingGlSection[]>([])
  const [glModalLoading, setGlModalLoading] = useState(false)
  const [glModalError, setGlModalError] = useState<string | null>(null)

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

  const closeGlModal = () => {
    setGlModalOpen(false)
    setGlModalError(null)
    setGlModalSections([])
  }

  const openAdvanceGlModal = (a: VendorAdvance) => {
    void (async () => {
      setGlModalTitle('GL entries — Vendor advance')
      setGlModalOpen(true)
      setGlModalLoading(true)
      setGlModalError(null)
      setGlModalSections([])
      try {
        const [main, detail] = await Promise.all([
          api.listGeneralLedgerEntries(projectId, {
            sourceKind: GL_SOURCE_KINDS.vendorAdvance,
            sourceId: a.id,
          }),
          api.getVendorAdvance(projectId, a.id),
        ])
        const usages = detail?.usages ?? []
        const usageEntryLists =
          usages.length > 0
            ? await Promise.all(
                usages.map((u) =>
                  api.listGeneralLedgerEntries(projectId, {
                    sourceKind: GL_SOURCE_KINDS.vendorAdvanceUsage,
                    sourceId: u.id,
                  }),
                ),
              )
            : []
        const sections: VendorBillingGlSection[] = [
          {
            title: 'Advance posting (prepaid / clearing)',
            subtitle: `Paid ${formatDate(a.paidDate)}`,
            entries: main,
          },
        ]
        usages.forEach((u, idx) => {
          sections.push({
            title: 'Applied usage',
            subtitle: `${formatDate(u.usageDate)} — ${u.description}`,
            entries: usageEntryLists[idx] ?? [],
          })
        })
        setGlModalSections(sections)
      } catch (e) {
        setGlModalError(e instanceof Error ? e.message : 'Could not load GL entries.')
      } finally {
        setGlModalLoading(false)
      }
    })()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Prepayments to vendors (advance pool). Apply balances when recording invoice payments.
        </p>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPanelAdvance('new')}
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
            >
              Add advance
            </button>
            <button
              type="button"
              onClick={() => void reload().then(() => onRefresh())}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        ) : null}
      </div>
      {loading ? <p className="text-sm text-slate-600">Loading…</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="min-w-[2.75rem] px-2 py-3">Actions</th>
              <th className="px-4 py-3">Paid</th>
              {!vendorId ? <th className="px-4 py-3">Vendor</th> : null}
              <th className="px-4 py-3 text-right">Advance</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3">Source</th>
              <th className="w-11 min-w-[2.75rem] px-2 py-3">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {advances.length === 0 ? (
              <tr>
                <td
                  colSpan={vendorId ? 6 : 7}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No advances{vendorId ? ' for this vendor' : ''}. Use <span className="font-medium">Add advance</span>.
                </td>
              </tr>
            ) : (
              advances.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="whitespace-nowrap px-2 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit advance"
                        aria-label="Edit advance"
                        disabled={readOnly}
                        className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                        onClick={() => setPanelAdvance(a)}
                      >
                        <PencilIcon />
                      </button>
                      <VendorBillingGlIconButton onClick={() => openAdvanceGlModal(a)} />
                    </div>
                  </td>
                  <td className="px-4 py-2">{formatDate(a.paidDate)}</td>
                  {!vendorId ? (
                    <td className="px-4 py-2">{vendorName.get(a.vendorId) ?? a.vendorId}</td>
                  ) : null}
                  <td className="px-4 py-2 text-right">
                    <MoneyAmount amount={a.amount} currency={a.currency} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {a.remainingBalance != null ? (
                      <MoneyAmount amount={a.remainingBalance} currency={a.currency} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 capitalize text-slate-600">{a.paymentSourceKind}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    <button
                      type="button"
                      title="Delete advance"
                      aria-label="Delete advance"
                      disabled={readOnly}
                      className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
                      onClick={() => {
                        if (!confirm('Delete this advance? Usages must be removed first.')) return
                        void (async () => {
                          try {
                            await api.deleteVendorAdvance(projectId, a.id)
                            await reload()
                            await onRefresh()
                          } catch (err) {
                            onError(err instanceof Error ? err.message : 'Delete failed.')
                          }
                        })()
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <VendorBillingGlModal
        open={glModalOpen}
        title={glModalTitle}
        sections={glModalSections}
        loading={glModalLoading}
        error={glModalError}
        onClose={closeGlModal}
      />

      {panelAdvance != null ? (
        <div className="fixed inset-0 z-[60] bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            <VendorAdvanceRecordPanel
              projectId={projectId}
              vendors={vendors}
              initialAdvance={panelAdvance === 'new' ? null : panelAdvance}
              defaultVendorId={vendorId}
              onClose={() => setPanelAdvance(null)}
              onSaved={async () => {
                await reload()
                await onRefresh()
              }}
              onError={onError}
              className="h-full overflow-y-auto rounded-none border-0 border-l border-slate-200 shadow-xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
