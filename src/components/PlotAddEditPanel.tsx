import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/dataApi'
import type { LandPlot, PlotStatus } from '../types'
import { plotStatusOptions } from './project-detail/constants'

type PlotPanelMode = 'add' | 'edit'

export function PlotAddEditPanel({
  mode,
  projectId,
  plot,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  mode: PlotPanelMode
  projectId: string
  plot?: LandPlot
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const initial = useMemo(() => {
    if (mode === 'edit' && plot) {
      return {
        plotNumber: plot.plotNumber ?? '',
        widthFeet: String(plot.widthFeet),
        lengthFeet: String(plot.lengthFeet),
        pricePerSqft: String(plot.pricePerSqft),
        totalPurchasePrice: String(plot.totalPurchasePrice),
        currency: plot.currency,
        isReserved: plot.isReserved,
        status: plot.status,
        plotDetails: plot.plotDetails ?? '',
        purchaseParty: plot.purchaseParty ?? '',
        finalPricePerSqft:
          plot.finalPricePerSqft != null ? String(plot.finalPricePerSqft) : '',
        finalTotalPurchasePrice:
          plot.finalTotalPurchasePrice != null ? String(plot.finalTotalPurchasePrice) : '',
        notes: plot.notes ?? '',
        isPublicUse: plot.isPublicUse,
      }
    }
    return {
      plotNumber: '',
      widthFeet: '',
      lengthFeet: '',
      pricePerSqft: '',
      totalPurchasePrice: '',
      currency: 'USD',
      isReserved: false,
      status: 'open' as PlotStatus,
      plotDetails: '',
      purchaseParty: '',
      finalPricePerSqft: '',
      finalTotalPurchasePrice: '',
      notes: '',
      isPublicUse: false,
    }
  }, [mode, plot])

  const [plotNumber, setPlotNumber] = useState(initial.plotNumber)
  const [widthFeet, setWidthFeet] = useState(initial.widthFeet)
  const [lengthFeet, setLengthFeet] = useState(initial.lengthFeet)
  const [pricePerSqft, setPricePerSqft] = useState(initial.pricePerSqft)
  const [totalPurchasePrice, setTotalPurchasePrice] = useState(initial.totalPurchasePrice)
  const [currency, setCurrency] = useState(initial.currency)
  const [isReserved, setIsReserved] = useState(initial.isReserved)
  const [status, setStatus] = useState<PlotStatus>(initial.status)
  const [plotDetails, setPlotDetails] = useState(initial.plotDetails)
  const [purchaseParty, setPurchaseParty] = useState(initial.purchaseParty)
  const [finalPricePerSqft, setFinalPricePerSqft] = useState(initial.finalPricePerSqft)
  const [finalTotalPurchasePrice, setFinalTotalPurchasePrice] = useState(
    initial.finalTotalPurchasePrice,
  )
  const [notes, setNotes] = useState(initial.notes)
  const [isPublicUse, setIsPublicUse] = useState(initial.isPublicUse)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPlotNumber(initial.plotNumber)
    setWidthFeet(initial.widthFeet)
    setLengthFeet(initial.lengthFeet)
    setPricePerSqft(initial.pricePerSqft)
    setTotalPurchasePrice(initial.totalPurchasePrice)
    setCurrency(initial.currency)
    setIsReserved(initial.isReserved)
    setStatus(initial.status)
    setPlotDetails(initial.plotDetails)
    setPurchaseParty(initial.purchaseParty)
    setFinalPricePerSqft(initial.finalPricePerSqft)
    setFinalTotalPurchasePrice(initial.finalTotalPurchasePrice)
    setNotes(initial.notes)
    setIsPublicUse(initial.isPublicUse)
  }, [initial])

  const title = mode === 'add' ? 'Add plot' : 'Edit plot'

  return (
    <div
      className={[
        'rounded-none border border-slate-200 bg-white p-6 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="text-lg font-medium text-slate-900">{title}</h2>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const w = Number(widthFeet)
          const l = Number(lengthFeet)
          const ppsf = Number(pricePerSqft)
          const tpp = Number(totalPurchasePrice)
          if (!widthFeet || !lengthFeet || w <= 0 || l <= 0) return
          if (Number.isNaN(ppsf) || ppsf < 0 || Number.isNaN(tpp) || tpp < 0) return

          const rawFpsf = finalPricePerSqft.trim()
          const rawFtotal = finalTotalPurchasePrice.trim()
          let fPpsf: number | null | undefined
          let fTotal: number | null | undefined
          if (mode === 'add') {
            if (!rawFpsf) fPpsf = undefined
            else {
              const n = Number(rawFpsf)
              if (Number.isNaN(n) || n < 0) {
                onError('Final price / sq ft must be a valid non-negative number.')
                return
              }
              fPpsf = n
            }
            if (!rawFtotal) fTotal = undefined
            else {
              const n = Number(rawFtotal)
              if (Number.isNaN(n) || n < 0) {
                onError('Final total purchase must be a valid non-negative number.')
                return
              }
              fTotal = n
            }
          } else {
            if (!rawFpsf) fPpsf = null
            else {
              const n = Number(rawFpsf)
              if (Number.isNaN(n) || n < 0) {
                onError('Final price / sq ft must be a valid non-negative number.')
                return
              }
              fPpsf = n
            }
            if (!rawFtotal) fTotal = null
            else {
              const n = Number(rawFtotal)
              if (Number.isNaN(n) || n < 0) {
                onError('Final total purchase must be a valid non-negative number.')
                return
              }
              fTotal = n
            }
          }

          onError(null)
          setSaving(true)
          try {
            if (mode === 'add') {
              await api.createPlot({
                projectId,
                plotNumber: plotNumber.trim() || undefined,
                widthFeet: w,
                lengthFeet: l,
                pricePerSqft: ppsf,
                totalPurchasePrice: tpp,
                currency: currency.trim() || 'USD',
                isReserved,
                status,
                plotDetails: plotDetails.trim() || undefined,
                purchaseParty: purchaseParty.trim() || undefined,
                finalPricePerSqft: fPpsf,
                finalTotalPurchasePrice: fTotal,
                notes: notes.trim() || undefined,
                isPublicUse,
              })
            } else if (plot) {
              await api.updatePlot(plot.id, projectId, {
                plotNumber: plotNumber.trim() === '' ? null : plotNumber.trim(),
                widthFeet: w,
                lengthFeet: l,
                pricePerSqft: ppsf,
                totalPurchasePrice: tpp,
                currency: currency.trim() || 'USD',
                isReserved,
                status,
                plotDetails: plotDetails.trim() === '' ? null : plotDetails.trim(),
                purchaseParty: purchaseParty.trim() === '' ? null : purchaseParty.trim(),
                finalPricePerSqft: fPpsf,
                finalTotalPurchasePrice: fTotal,
                notes: notes.trim() === '' ? null : notes.trim(),
                isPublicUse,
              })
            }
            await onRefresh()
            onClose()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not save plot.')
          } finally {
            setSaving(false)
          }
        }}
      >
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Plot number</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={plotNumber}
            onChange={(e) => setPlotNumber(e.target.value)}
            placeholder="e.g. A-12, Plot 7"
            maxLength={128}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Plot details</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={plotDetails}
            onChange={(e) => setPlotDetails(e.target.value)}
            placeholder="Corner lot, drainage, access, etc."
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Purchase party</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={purchaseParty}
            onChange={(e) => setPurchaseParty(e.target.value)}
            placeholder="Buyer or entity name"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Width (ft)</span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={widthFeet}
            onChange={(e) => setWidthFeet(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Length (ft)</span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={lengthFeet}
            onChange={(e) => setLengthFeet(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Posted price / sq ft
          </span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={pricePerSqft}
            onChange={(e) => setPricePerSqft(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Posted total purchase price
          </span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={totalPurchasePrice}
            onChange={(e) => setTotalPurchasePrice(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Final price / sq ft (optional)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={finalPricePerSqft}
            onChange={(e) => setFinalPricePerSqft(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Final total purchase price (optional)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={finalTotalPurchasePrice}
            onChange={(e) => setFinalTotalPurchasePrice(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Currency</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Status</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as PlotStatus)}
          >
            {plotStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Notes</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={isPublicUse}
            onChange={(e) => setIsPublicUse(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Public use (e.g. road, easement)</span>
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={isReserved}
            onChange={(e) => setIsReserved(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Reserved (not for sale)</span>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : mode === 'add' ? 'Add plot' : 'Save changes'}
          </button>
          <button
            type="button"
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
