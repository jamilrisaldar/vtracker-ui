import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PlotSaleReportResponse, PlotSaleReportRow } from '../types'
import { formatDate, formatMoney, formatMoneyForPdf } from './format'

function sanitizeFilenamePart(s: string): string {
  const t = s.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').trim()
  return t.slice(0, 48) || 'project'
}

function reportTitle(report: PlotSaleReportResponse['report']): string {
  return report === 'fiscal' ? 'Fiscal (registration date)' : 'Activity (payments in range)'
}

/** Registration dates are calendar days; API may send `YYYY-MM-DD` or full ISO. Avoid UTC midnight shifting. */
export function formatSubregistrarReportDate(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === '') return '—'
  const s = String(iso).trim()
  const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  if (ymd) {
    const parts = ymd.split('-').map(Number)
    const y = parts[0]
    const mo = parts[1]
    const d = parts[2]
    if (y == null || mo == null || d == null) return formatDate(s)
    const dt = new Date(y, mo - 1, d)
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(dt)
  }
  return formatDate(s)
}

function sortedPaymentModes(rows: PlotSaleReportRow[]): string[] {
  const set = new Set<string>()
  for (const r of rows) {
    for (const k of Object.keys(r.paymentTotalsByMode)) {
      if (r.paymentTotalsByMode[k] !== 0) set.add(k)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export type PlotSaleReportCurrencyTotals = {
  currency: string
  negotiatedFinalPriceSum: number
  paymentModeSums: Record<string, number>
  paymentGrandTotal: number
}

export function computePlotSaleReportGrandTotals(
  rows: PlotSaleReportRow[],
  modes: string[],
): PlotSaleReportCurrencyTotals[] {
  const by = new Map<string, { nfp: number; modeSums: Record<string, number> }>()
  for (const r of rows) {
    const c = (r.currency ?? 'INR').trim() || 'INR'
    let bucket = by.get(c)
    if (!bucket) {
      bucket = {
        nfp: 0,
        modeSums: Object.fromEntries(modes.map((m) => [m, 0])) as Record<string, number>,
      }
      by.set(c, bucket)
    }
    if (r.negotiatedFinalPrice != null && Number.isFinite(r.negotiatedFinalPrice)) {
      bucket.nfp += r.negotiatedFinalPrice
    }
    for (const m of modes) {
      bucket.modeSums[m] = (bucket.modeSums[m] ?? 0) + (r.paymentTotalsByMode[m] ?? 0)
    }
  }
  return [...by.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((currency) => {
      const b = by.get(currency)!
      const paymentGrandTotal = modes.reduce((s, m) => s + (b.modeSums[m] ?? 0), 0)
      return {
        currency,
        negotiatedFinalPriceSum: b.nfp,
        paymentModeSums: b.modeSums,
        paymentGrandTotal,
      }
    })
}

function baseHeaders(modes: string[]): string[] {
  return [
    'Plot #',
    'Sale type',
    'Purchaser',
    'Subregistrar reg. date',
    'Negotiated final price',
    ...modes,
    'Row total (modes)',
    'Group id',
  ]
}

/** Negotiated price, each payment mode, and row total — not text or group id columns. */
export function plotSaleReportIsAmountColumn(colIdx: number, headerCount: number): boolean {
  if (headerCount < 6) return false
  return colIdx >= 4 && colIdx <= headerCount - 2
}

function pdfAmountColumnStyles(headerCount: number): Record<string, { halign: 'right' }> {
  const out: Record<string, { halign: 'right' }> = {}
  for (let i = 4; i <= headerCount - 2; i++) {
    out[String(i)] = { halign: 'right' }
  }
  return out
}

function rowCells(r: PlotSaleReportRow, modes: string[]): (string | number)[] {
  const price =
    r.negotiatedFinalPrice != null && Number.isFinite(r.negotiatedFinalPrice)
      ? r.negotiatedFinalPrice
      : ''
  const modeVals = modes.map((m) => {
    const v = r.paymentTotalsByMode[m]
    return v != null && v !== 0 ? v : ''
  })
  const rowSum = modes.reduce((s, m) => s + (r.paymentTotalsByMode[m] ?? 0), 0)
  return [
    r.plotNumber ?? '—',
    r.isCombinedSale ? 'Combined plot sale' : 'Single plot',
    r.purchaserName ?? '—',
    formatSubregistrarReportDate(r.subregistrarRegistrationDate ?? undefined),
    price === '' ? '—' : price,
    ...modeVals,
    rowSum !== 0 ? rowSum : '',
    r.combinedGroupId ?? '',
  ]
}

function grandTotalExcelRows(
  totals: PlotSaleReportCurrencyTotals[],
  modes: string[],
): (string | number)[][] {
  return totals.map((t) => [
    `Grand total (${t.currency})`,
    '',
    '',
    '',
    t.negotiatedFinalPriceSum,
    ...modes.map((m) => {
      const v = t.paymentModeSums[m] ?? 0
      return v !== 0 ? v : ''
    }),
    t.paymentGrandTotal !== 0 ? t.paymentGrandTotal : '',
    '',
  ])
}

function grandTotalPdfRows(totals: PlotSaleReportCurrencyTotals[], modes: string[]): string[][] {
  return totals.map((t) => [
    `Grand total (${t.currency})`,
    '',
    '',
    '',
    formatMoneyForPdf(t.negotiatedFinalPriceSum, t.currency),
    ...modes.map((m) => {
      const v = t.paymentModeSums[m] ?? 0
      return v !== 0 ? formatMoneyForPdf(v, t.currency) : '—'
    }),
    t.paymentGrandTotal !== 0 ? formatMoneyForPdf(t.paymentGrandTotal, t.currency) : '—',
    '',
  ])
}

export function exportPlotSaleReportExcel(projectName: string, data: PlotSaleReportResponse): void {
  const modes = sortedPaymentModes(data.rows)
  const headers = baseHeaders(modes)
  const title = reportTitle(data.report)
  const body = data.rows.map((r) => rowCells(r, modes))
  const grandRows =
    data.rows.length > 0 ? grandTotalExcelRows(computePlotSaleReportGrandTotals(data.rows, modes), modes) : []
  const aoa: (string | number)[][] = [
    ['Project', projectName],
    ['Report', title],
    ['Date range', `${data.startDate} → ${data.endDate}`],
    ['Exported (UTC)', new Date().toISOString()],
    ['Note', data.note],
    ['Row count', data.rows.length],
    [],
    [...headers],
    ...body,
    ...(grandRows.length > 0 ? [[], ...grandRows] : []),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Plot sale report')
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(
    wb,
    `plot_sale_${data.report}_${sanitizeFilenamePart(projectName)}_${stamp}.xlsx`,
  )
}

export function exportPlotSaleReportPdf(projectName: string, data: PlotSaleReportResponse): void {
  const modes = sortedPaymentModes(data.rows)
  const headers = baseHeaders(modes)
  const title = reportTitle(data.report)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margin = 40
  let y = margin

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Plot sale report — ${projectName}`, margin, y)
  y += 20
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${title} · ${data.startDate} → ${data.endDate}`, margin, y)
  y += 14
  const noteLines = doc.splitTextToSize(data.note, doc.internal.pageSize.getWidth() - margin * 2)
  doc.text(noteLines, margin, y)
  y += noteLines.length * 11 + 10

  const lastCol = headers.length - 1
  const priceCol = 4

  const formatBodyCell = (
    r: PlotSaleReportRow,
    cell: string | number,
    colIdx: number,
  ): string => {
    if (colIdx === lastCol && typeof cell === 'string' && cell.length > 14) {
      return `${cell.slice(0, 8)}…`
    }
    if (
      colIdx === 0 ||
      colIdx === 1 ||
      colIdx === 2 ||
      colIdx === 3 ||
      colIdx === lastCol
    ) {
      return String(cell === '' ? '—' : cell)
    }
    if (colIdx === priceCol && typeof cell === 'number') {
      return formatMoneyForPdf(cell, r.currency)
    }
    if (typeof cell === 'number' && cell !== 0) {
      return formatMoneyForPdf(cell, r.currency)
    }
    return cell === '' || cell === '—' ? '—' : String(cell)
  }

  const tableBody = data.rows.map((r) => {
    const cells = rowCells(r, modes)
    return cells.map((cell, colIdx) => formatBodyCell(r, cell, colIdx))
  })

  const footRows =
    data.rows.length > 0 ? grandTotalPdfRows(computePlotSaleReportGrandTotals(data.rows, modes), modes) : []

  const hc = headers.length
  autoTable(doc, {
    startY: y,
    head: [headers],
    body: tableBody,
    foot: footRows.length > 0 ? footRows : undefined,
    showFoot: footRows.length > 0 ? 'lastPage' : 'never',
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [13, 148, 136] },
    columnStyles: pdfAmountColumnStyles(hc),
    margin: { left: margin, right: margin },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`plot_sale_${data.report}_${sanitizeFilenamePart(projectName)}_${stamp}.pdf`)
}

/** Plain display cells for on-screen preview (formatted money for price column). */
export function plotSaleReportPreviewRows(data: PlotSaleReportResponse): {
  headers: string[]
  rows: string[][]
  grandTotalRows: string[][]
} {
  const modes = sortedPaymentModes(data.rows)
  const headers = baseHeaders(modes)
  const rows = data.rows.map((r) => {
    const cells = rowCells(r, modes)
    return cells.map((cell, colIdx) => {
      if (colIdx === 4 && typeof cell === 'number') return formatMoney(cell, r.currency)
      if (typeof cell === 'number' && cell !== 0) return formatMoney(cell, r.currency)
      if (cell === '' || cell === '—') return '—'
      return String(cell)
    })
  })
  const totals =
    data.rows.length > 0 ? computePlotSaleReportGrandTotals(data.rows, modes) : []
  const grandTotalRows = totals.map((t) => {
    const cells = grandTotalExcelRows([t], modes)[0]
    return cells.map((cell, colIdx) => {
      if (colIdx === 4 && typeof cell === 'number') return formatMoney(cell, t.currency)
      if (typeof cell === 'number' && cell !== 0) return formatMoney(cell, t.currency)
      if (cell === '' || cell === '—') return '—'
      return String(cell)
    })
  })
  return { headers, rows, grandTotalRows }
}
