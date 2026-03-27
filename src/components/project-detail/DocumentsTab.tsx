import { useState } from 'react'
import * as api from '../../api/dataApi'
import type { DocumentKind, Invoice, Payment, ProjectDocument, Vendor } from '../../types'
import { formatDate, formatMoney } from '../../utils/format'
import { docKindOptions } from './constants'

export function DocumentsTab({
  projectId,
  documents,
  vendors,
  invoices,
  payments,
  onRefresh,
  onError,
  readOnly = false,
}: {
  projectId: string
  documents: ProjectDocument[]
  vendors: Vendor[]
  invoices: Invoice[]
  payments: Payment[]
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  readOnly?: boolean
}) {
  const [kind, setKind] = useState<DocumentKind>('invoice')
  const [vendorId, setVendorId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [file, setFile] = useState<File | null>(null)

  return (
    <div className="space-y-6">
      {readOnly ? (
        <p className="text-xs text-amber-800/90">View-only: uploads are disabled.</p>
      ) : null}
      {!readOnly ? (
      <form
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!file) return
          onError(null)
          try {
            await api.uploadDocument({
              projectId,
              file,
              kind,
              vendorId: vendorId || undefined,
              invoiceId: invoiceId || undefined,
              paymentId: paymentId || undefined,
            })
            setFile(null)
            setVendorId('')
            setInvoiceId('')
            setPaymentId('')
            await onRefresh()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Upload failed.')
          }
        }}
      >
        <h2 className="text-lg font-medium text-slate-900">Upload document</h2>
        <p className="mt-1 text-xs text-slate-500">
          Mock storage keeps files in browser local storage (max ~450 KB per file).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">File</span>
            <input
              required
              type="file"
              className="mt-1 w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Type</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as DocumentKind)}
            >
              {docKindOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">
              Vendor (optional)
            </span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">
              Link to invoice (optional)
            </span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            >
              <option value="">—</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">
              Link to payment (optional)
            </span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
            >
              <option value="">—</option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id.slice(-8)} — {formatDate(p.paidDate)} —{' '}
                  {formatMoney(p.amount)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Upload
        </button>
      </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No documents yet.
                </td>
              </tr>
            ) : (
              documents.map((d) => {
                const fileUrl = d.dataUrl ?? d.downloadUrl
                return (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium">
                      {d.fileName}
                    </td>
                    <td className="px-4 py-3 capitalize">{d.kind.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(d.uploadedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {fileUrl && d.mimeType.startsWith('image/') ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-700 hover:underline"
                        >
                          <img
                            src={fileUrl}
                            alt=""
                            className="h-12 w-16 rounded object-cover"
                          />
                        </a>
                      ) : fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-700 hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={readOnly}
                        className="text-xs text-red-600 hover:underline disabled:opacity-40"
                        onClick={() => {
                          if (!confirm('Remove this document?')) return
                          void (async () => {
                            try {
                              await api.deleteDocument(d.id, projectId)
                              await onRefresh()
                            } catch (err) {
                              onError(err instanceof Error ? err.message : 'Delete failed.')
                            }
                          })()
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
