import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/dataApi'
import type { LandPlot, PlotStatus } from '../types'
import { plotCalculatedSqFtFromDimensions } from '../utils/landPlotDisplay'
import { plotStatusOptions } from './project-detail/constants'

type PlotPanelMode = 'add' | 'edit'

function formatPostedTotalInput(n: number): string {
  const rounded = Math.round(n * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

function computedSqFtFromFormStrings(
  isIrregular: boolean,
  w1: string,
  l1: string,
  w2: string,
  l2: string,
): number | null {
  const n = (s: string): number | null => {
    const x = Number(s)
    if (!s.trim() || Number.isNaN(x) || x <= 0) return null
    return x
  }
  if (!isIrregular) {
    const wf = n(w1)
    const lf = n(l1)
    if (wf == null || lf == null) return null
    return plotCalculatedSqFtFromDimensions({
      isIrregular: false,
      widthFeet: wf,
      lengthFeet: lf,
    })
  }
  const wf = n(w1)
  const lf = n(l1)
  const wf2 = n(w2)
  const lf2 = n(l2)
  if (wf == null || lf == null || wf2 == null || lf2 == null) return null
  return plotCalculatedSqFtFromDimensions({
    isIrregular: true,
    widthFeet: wf,
    lengthFeet: lf,
    widthFeet2: wf2,
    lengthFeet2: lf2,
  })
}

function landPlotToFormInitial(source: LandPlot) {
  return {
    plotNumber: source.plotNumber ?? '',
    isIrregular: source.isIrregular ?? false,
    widthFeet: source.widthFeet != null ? String(source.widthFeet) : '',
    lengthFeet: source.lengthFeet != null ? String(source.lengthFeet) : '',
    widthFeet2: source.widthFeet2 != null ? String(source.widthFeet2) : '',
    lengthFeet2: source.lengthFeet2 != null ? String(source.lengthFeet2) : '',
    totalSqFtOverride:
      source.totalSquareFeetOverride != null && source.totalSquareFeetOverride > 0
        ? String(source.totalSquareFeetOverride)
        : '',
    pricePerSqft: String(source.pricePerSqft),
    totalPurchasePrice:
      source.totalPurchasePrice != null ? String(source.totalPurchasePrice) : '',
    currency: source.currency,
    isReserved: source.isReserved,
    status: source.status,
    plotDetails: source.plotDetails ?? '',
    purchaseParty: source.purchaseParty ?? '',
    finalPricePerSqft:
      source.finalPricePerSqft != null ? String(source.finalPricePerSqft) : '',
    finalTotalPurchasePrice:
      source.finalTotalPurchasePrice != null ? String(source.finalTotalPurchasePrice) : '',
    notes: source.notes ?? '',
    isPublicUse: source.isPublicUse,
  }
}

export function PlotAddEditPanel({
  mode,
  projectId,
  plot,
  copyFrom,
  onClose,
  onRefresh,
  onError,
  className,
}: {
  mode: PlotPanelMode
  projectId: string
  plot?: LandPlot
  copyFrom?: LandPlot
  onClose: () => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  className?: string
}) {
  const initial = useMemo(() => {
    if (mode === 'edit' && plot) {
      return landPlotToFormInitial(plot)
    }
    if (mode === 'add' && copyFrom) {
      const base = landPlotToFormInitial(copyFrom)
      const pn = copyFrom.plotNumber?.trim()
      return {
        ...base,
        plotNumber: pn ? `${pn} (copy)` : '',
      }
    }
    return {
      plotNumber: '',
      isIrregular: false,
      widthFeet: '',
      lengthFeet: '',
      widthFeet2: '',
      lengthFeet2: '',
      totalSqFtOverride: '',
      pricePerSqft: '',
      totalPurchasePrice: '',
      currency: 'INR',
      isReserved: false,
      status: 'open' as PlotStatus,
      plotDetails: '',
      purchaseParty: '',
      finalPricePerSqft: '',
      finalTotalPurchasePrice: '',
      notes: '',
      isPublicUse: false,
    }
  }, [mode, plot, copyFrom])

  const [plotNumber, setPlotNumber] = useState(initial.plotNumber)
  const [isIrregular, setIsIrregular] = useState(initial.isIrregular)
  const [widthFeet, setWidthFeet] = useState(initial.widthFeet)
  const [lengthFeet, setLengthFeet] = useState(initial.lengthFeet)
  const [widthFeet2, setWidthFeet2] = useState(initial.widthFeet2)
  const [lengthFeet2, setLengthFeet2] = useState(initial.lengthFeet2)
  const [totalSqFtOverride, setTotalSqFtOverride] = useState(initial.totalSqFtOverride)
  const [pricePerSqft, setPricePerSqft] = useState(initial.pricePerSqft)
  const [totalPurchasePrice, setTotalPurchasePrice] = useState(initial.totalPurchasePrice)
  /** When false, posted total follows effective area × posted $/sq ft. */
  const [postedTotalManual, setPostedTotalManual] = useState(
    () => initial.totalPurchasePrice.trim() !== '',
  )
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
    setIsIrregular(initial.isIrregular)
    setWidthFeet(initial.widthFeet)
    setLengthFeet(initial.lengthFeet)
    setWidthFeet2(initial.widthFeet2)
    setLengthFeet2(initial.lengthFeet2)
    setTotalSqFtOverride(initial.totalSqFtOverride)
    setPricePerSqft(initial.pricePerSqft)
    setTotalPurchasePrice(initial.totalPurchasePrice)
    setPostedTotalManual(initial.totalPurchasePrice.trim() !== '')
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

  const computedFromDims = useMemo(
    () =>
      computedSqFtFromFormStrings(
        isIrregular,
        widthFeet,
        lengthFeet,
        widthFeet2,
        lengthFeet2,
      ),
    [isIrregular, widthFeet, lengthFeet, widthFeet2, lengthFeet2],
  )

  /** Positive override only; 0 / empty = use calculated area (matches API / table behavior). */
  const positiveSqFtOverride = useMemo(() => {
    const o = totalSqFtOverride.trim()
    if (o === '') return null
    const n = Number(o)
    if (Number.isNaN(n) || n <= 0) return null
    return n
  }, [totalSqFtOverride])

  const previewEffectiveSqFt = useMemo(() => {
    return positiveSqFtOverride ?? computedFromDims
  }, [positiveSqFtOverride, computedFromDims])

  const autoPostedTotalPurchase = useMemo(() => {
    const ppsf = Number(pricePerSqft)
    if (!pricePerSqft.trim() || Number.isNaN(ppsf) || ppsf < 0) return null
    const area = previewEffectiveSqFt
    if (area == null || area <= 0) return null
    return area * ppsf
  }, [pricePerSqft, previewEffectiveSqFt])

  useEffect(() => {
    if (postedTotalManual) return
    if (autoPostedTotalPurchase == null) {
      setTotalPurchasePrice('')
      return
    }
    setTotalPurchasePrice(formatPostedTotalInput(autoPostedTotalPurchase))
  }, [autoPostedTotalPurchase, postedTotalManual])

  const title =
    mode === 'add' ? (copyFrom ? 'Add plot (copy)' : 'Add plot') : 'Edit plot'

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
      {mode === 'add' && copyFrom ? (
        <p className="mt-1 text-sm text-slate-600">
          Pre-filled from the selected plot. Adjust as needed, then save to create a new plot.
        </p>
      ) : null}
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const ppsf = Number(pricePerSqft)
          if (!pricePerSqft.trim() || Number.isNaN(ppsf) || ppsf < 0) {
            onError('Posted price per sq ft is required and must be a valid non-negative number.')
            return
          }

          const rawTpp = totalPurchasePrice.trim()
          let tpp: number | undefined | null
          if (mode === 'add') {
            if (!rawTpp) tpp = undefined
            else {
              const n = Number(rawTpp)
              if (Number.isNaN(n) || n < 0) {
                onError('Posted total purchase must be a valid non-negative number.')
                return
              }
              tpp = n
            }
          } else {
            if (!rawTpp) tpp = null
            else {
              const n = Number(rawTpp)
              if (Number.isNaN(n) || n < 0) {
                onError('Posted total purchase must be a valid non-negative number.')
                return
              }
              tpp = n
            }
          }

          const rawOverride = totalSqFtOverride.trim()
          let totalSquareFeetOverride: number | undefined | null
          if (mode === 'add') {
            if (!rawOverride) totalSquareFeetOverride = undefined
            else {
              const n = Number(rawOverride)
              if (Number.isNaN(n) || n < 0) {
                onError('Total square feet override must be a valid non-negative number.')
                return
              }
              totalSquareFeetOverride = n === 0 ? undefined : n
            }
          } else {
            if (!rawOverride) totalSquareFeetOverride = null
            else {
              const n = Number(rawOverride)
              if (Number.isNaN(n) || n < 0) {
                onError('Total square feet override must be a valid non-negative number.')
                return
              }
              totalSquareFeetOverride = n === 0 ? null : n
            }
          }

          let w1: number | undefined
          let l1: number | undefined
          let w2: number | undefined
          let l2: number | undefined
          if (isIrregular) {
            const a = Number(widthFeet)
            const b = Number(lengthFeet)
            const c = Number(widthFeet2)
            const d = Number(lengthFeet2)
            if (
              !widthFeet.trim() ||
              !lengthFeet.trim() ||
              !widthFeet2.trim() ||
              !lengthFeet2.trim() ||
              Number.isNaN(a) ||
              Number.isNaN(b) ||
              Number.isNaN(c) ||
              Number.isNaN(d)
            ) {
              onError(
                'Irregular plots require all four measurements (width 1, length 1, width 2, length 2) as positive numbers.',
              )
              return
            }
            if (a <= 0 || b <= 0 || c <= 0 || d <= 0) {
              onError('All width and length values must be greater than zero.')
              return
            }
            w1 = a
            l1 = b
            w2 = c
            l2 = d
          } else {
            const w = Number(widthFeet)
            const l = Number(lengthFeet)
            if (!widthFeet.trim() || !lengthFeet.trim() || Number.isNaN(w) || Number.isNaN(l)) {
              onError('Width and length (first set) are required as positive numbers.')
              return
            }
            if (w <= 0 || l <= 0) {
              onError('Width and length (first set) must be greater than zero.')
              return
            }
            w1 = w
            l1 = l
          }

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
                isIrregular,
                widthFeet: w1,
                lengthFeet: l1,
                widthFeet2: isIrregular ? w2 : undefined,
                lengthFeet2: isIrregular ? l2 : undefined,
                totalSquareFeetOverride: totalSquareFeetOverride ?? undefined,
                pricePerSqft: ppsf,
                totalPurchasePrice: tpp ?? undefined,
                currency: currency.trim() || 'INR',
                isReserved,
                status,
                plotDetails: plotDetails.trim() || undefined,
                purchaseParty: purchaseParty.trim() || undefined,
                finalPricePerSqft: fPpsf ?? undefined,
                finalTotalPurchasePrice: fTotal ?? undefined,
                notes: notes.trim() || undefined,
                isPublicUse,
              })
            } else if (plot) {
              await api.updatePlot(plot.id, projectId, {
                plotNumber: plotNumber.trim() === '' ? null : plotNumber.trim(),
                isIrregular,
                ...(isIrregular
                  ? {
                      widthFeet: w1!,
                      lengthFeet: l1!,
                      widthFeet2: w2!,
                      lengthFeet2: l2!,
                    }
                  : {
                      widthFeet: w1!,
                      lengthFeet: l1!,
                      widthFeet2: null,
                      lengthFeet2: null,
                    }),
                totalSquareFeetOverride,
                pricePerSqft: ppsf,
                totalPurchasePrice: tpp,
                currency: currency.trim() || 'INR',
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

        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={isIrregular}
            onChange={(e) => setIsIrregular(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            Irregular shape: enter four side lengths in order (W1 → L1 → W2 → L2 ft). Area uses all four
            sides (cyclic quadrilateral); override if you need an exact survey figure.
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Width 1 (ft)</span>
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
          <span className="text-xs font-medium text-slate-600">Length 1 (ft)</span>
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

        {isIrregular ? (
          <>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Width 2 (ft)</span>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={widthFeet2}
                onChange={(e) => setWidthFeet2(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Length 2 (ft)</span>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={lengthFeet2}
                onChange={(e) => setLengthFeet2(e.target.value)}
              />
            </label>
          </>
        ) : null}

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 sm:col-span-2">
          <p className="text-xs font-medium text-slate-600">Area</p>
          <p className="mt-1 text-sm text-slate-800">
            Calculated from dimensions
            {isIrregular ? ' (4 sides)' : ''}:{' '}
            {computedFromDims != null
              ? `${computedFromDims.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq ft`
              : '—'}
          </p>
          {positiveSqFtOverride != null && (
            <p className="mt-1 text-sm font-medium text-teal-800">
              Effective (with override):{' '}
              {positiveSqFtOverride.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq ft
            </p>
          )}
        </div>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">
            Total square feet override (optional)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={totalSqFtOverride}
            onChange={(e) => setTotalSqFtOverride(e.target.value)}
            placeholder={
              computedFromDims != null
                ? `Leave empty to use ${computedFromDims.toFixed(2)} sq ft`
                : 'Override total sq ft if needed'
            }
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
            Posted total purchase price (optional)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={totalPurchasePrice}
            onChange={(e) => {
              const v = e.target.value
              setTotalPurchasePrice(v)
              setPostedTotalManual(v.trim() !== '')
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            {postedTotalManual
              ? 'Manual value. Clear the field to use area × posted price / sq ft again.'
              : autoPostedTotalPurchase != null
                ? `Filled as effective area × posted price / sq ft (${previewEffectiveSqFt?.toLocaleString(undefined, { maximumFractionDigits: 2 })} × ${pricePerSqft.trim() || '—'}). Edit to override.`
                : 'Enter dimensions and posted price / sq ft to auto-fill, or type a total.'}
          </p>
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
