import type { ProjectReport } from '../../types'
import { formatDate, formatMoney } from '../../utils/format'

export function ReportsTab({
  report,
  vendorName,
}: {
  report: ProjectReport
  vendorName: Map<string, string>
}) {
  return (
    <div className="space-y-6 print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h2 className="text-lg font-medium text-slate-900">Project report</h2>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
        <h3 className="text-base font-semibold text-slate-900">
          {report.project.name}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Generated {formatDate(new Date().toISOString())}
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-medium uppercase text-slate-500">
              Total invoiced
            </dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900">
              {formatMoney(report.totalInvoiced)}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-medium uppercase text-slate-500">
              Total paid
            </dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900">
              {formatMoney(report.totalPaid)}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-medium uppercase text-slate-500">
              Outstanding
            </dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900">
              {formatMoney(report.outstanding)}
            </dd>
          </div>
        </dl>

        <section className="mt-8">
          <h4 className="text-sm font-semibold text-slate-900">By vendor</h4>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2">Invoiced</th>
                  <th className="px-3 py-2">Paid</th>
                </tr>
              </thead>
              <tbody>
                {report.byVendor.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                      No vendor spend yet.
                    </td>
                  </tr>
                ) : (
                  report.byVendor.map((row) => (
                    <tr key={row.vendorId} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">
                        {vendorName.get(row.vendorId) ?? row.vendorName}
                      </td>
                      <td className="px-3 py-2">{formatMoney(row.invoiced)}</td>
                      <td className="px-3 py-2">{formatMoney(row.paid)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h4 className="text-sm font-semibold text-slate-900">Phases</h4>
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {report.byPhase.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-slate-500">
                No phases.
              </li>
            ) : (
              report.byPhase.map((ph) => (
                <li
                  key={ph.phaseId}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-800">{ph.phaseName}</span>
                  <span className="capitalize text-slate-600">
                    {ph.status.replace('_', ' ')}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <p className="mt-6 text-xs text-slate-500">
          Invoices recorded: {report.invoiceCount}. Payments recorded:{' '}
          {report.paymentCount}.
        </p>
      </div>
    </div>
  )
}
