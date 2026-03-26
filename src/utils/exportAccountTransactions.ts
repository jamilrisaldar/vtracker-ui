import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Account, AccountTransaction, AccountTransactionListFilters } from '../types'
import { formatDate, formatMoney, formatMoneyForPdf } from './format'

function sanitizeFilenamePart(s: string): string {
  const t = s.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').trim()
  return t.slice(0, 48) || 'account'
}

export function formatTransactionExportFilterSummary(
  filters: AccountTransactionListFilters,
  projectNameById: Map<string, string>,
): string {
  const parts: string[] = []
  if (filters.occurredOnFrom) parts.push(`Date from ${filters.occurredOnFrom}`)
  if (filters.occurredOnTo) parts.push(`Date to ${filters.occurredOnTo}`)
  if (filters.projectId) {
    parts.push(`Project: ${projectNameById.get(filters.projectId) ?? filters.projectId}`)
  }
  if (filters.descriptionContains) {
    parts.push(`Description contains "${filters.descriptionContains}"`)
  }
  if (filters.bankMemoContains) {
    parts.push(`Bank memo contains "${filters.bankMemoContains}"`)
  }
  if (filters.transactionCategoryContains) {
    parts.push(`Category contains "${filters.transactionCategoryContains}"`)
  }
  return parts.length > 0 ? parts.join('; ') : 'None (all transactions in this account)'
}

const HEADERS = [
  'Date',
  'Entry',
  'Amount',
  'Running balance',
  'Project',
  'Plots',
  'Description',
  'Bank memo',
  'Category',
  'Payment ID',
] as const

function transactionRows(
  transactions: AccountTransaction[],
  projectNameById: Map<string, string>,
  currency: string,
): (string | number)[][] {
  return transactions.map((t) => [
    formatDate(t.occurredOn),
    t.entryType,
    formatMoney(t.amount, currency),
    t.runningBalance != null ? formatMoney(t.runningBalance, currency) : '',
    t.projectId ? projectNameById.get(t.projectId) ?? '' : '',
    t.plotNumberLabels ?? '',
    t.description ?? '',
    t.bankMemo ?? '',
    t.transactionCategory ?? '',
    t.paymentId ?? '',
  ])
}

export function exportAccountTransactionsExcel(
  account: Account,
  transactions: AccountTransaction[],
  projectNameById: Map<string, string>,
  appliedFilters: AccountTransactionListFilters,
): void {
  const summary = formatTransactionExportFilterSummary(appliedFilters, projectNameById)
  const body = transactionRows(transactions, projectNameById, account.currency)
  const aoa: (string | number)[][] = [
    ['Account', account.name],
    ['Currency', account.currency],
    ['Exported (UTC)', new Date().toISOString()],
    ['Filters applied', summary],
    ['Row count', transactions.length],
    [],
    [...HEADERS],
    ...body,
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 14 },
    { wch: 8 },
    { wch: 20 },
    { wch: 22 },
    { wch: 28 },
    { wch: 20 },
    { wch: 40 },
    { wch: 28 },
    { wch: 18 },
    { wch: 38 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `transactions_${sanitizeFilenamePart(account.name)}_${stamp}.xlsx`)
}

export function exportAccountTransactionsPdf(
  account: Account,
  transactions: AccountTransaction[],
  projectNameById: Map<string, string>,
  appliedFilters: AccountTransactionListFilters,
): void {
  const summary = formatTransactionExportFilterSummary(appliedFilters, projectNameById)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = margin

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Transactions — ${account.name}`, margin, y)
  y += 22

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Currency: ${account.currency}`, margin, y)
  y += 14
  doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y)
  y += 14
  doc.text(`Rows: ${transactions.length}`, margin, y)
  y += 14

  const filterLines = doc.splitTextToSize(`Filters: ${summary}`, pageW - margin * 2)
  doc.text(filterLines, margin, y)
  y += filterLines.length * 11 + 16

  const body = transactions.map((t) => [
    formatDate(t.occurredOn),
    t.entryType,
    formatMoneyForPdf(t.amount, account.currency),
    t.runningBalance != null
      ? formatMoneyForPdf(t.runningBalance, account.currency)
      : '—',
    t.projectId ? projectNameById.get(t.projectId) ?? '—' : '—',
    t.plotNumberLabels ?? '—',
    (t.description ?? '—').replace(/\s+/g, ' ').trim(),
    (t.bankMemo ?? '—').replace(/\s+/g, ' ').trim(),
    t.transactionCategory ?? '—',
    t.paymentId ? t.paymentId : '—',
  ])

  autoTable(doc, {
    startY: y,
    head: [HEADERS as unknown as string[]],
    body,
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [13, 118, 110], textColor: 255 },
    didParseCell: (data) => {
      const i = data.column.index
      if (i === 2 || i === 3) {
        data.cell.styles.halign = 'right'
      }
    },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 44 },
      2: { cellWidth: 88, halign: 'right' },
      3: { cellWidth: 92, halign: 'right' },
      4: { cellWidth: 90 },
      5: { cellWidth: 64 },
      6: { cellWidth: 110 },
      7: { cellWidth: 80 },
      8: { cellWidth: 64 },
      9: { cellWidth: 100 },
    },
    margin: { left: margin, right: margin },
    showHead: 'everyPage',
    tableWidth: 'auto',
  })

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`transactions_${sanitizeFilenamePart(account.name)}_${stamp}.pdf`)
}
