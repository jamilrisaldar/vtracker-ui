import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  DocumentKind,
  Invoice,
  Payment,
  Phase,
  PhaseStatus,
  Project,
  ProjectDocument,
  ProjectStatus,
  Vendor,
} from '../types'
import * as api from '../api/dataApi'
import type { ProjectReport } from '../types'
import { formatDate, formatMoney } from '../utils/format'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'phases', label: 'Phases & tasks' },
  { id: 'vendors', label: 'Vendors & billing' },
  { id: 'documents', label: 'Documents' },
  { id: 'reports', label: 'Reports' },
] as const

type TabId = (typeof tabs)[number]['id']

const projectStatusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
]

const phaseStatusOptions: { value: PhaseStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

const docKindOptions: { value: DocumentKind; label: string }[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'payment_proof', label: 'Payment proof' },
  { value: 'progress_photo', label: 'Progress photo' },
  { value: 'other', label: 'Other' },
]

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: TabId = tabs.some((t) => t.id === rawTab)
    ? (rawTab as TabId)
    : 'overview'
  const setTab = (t: TabId) => {
    setSearchParams({ tab: t }, { replace: true })
  }

  const [project, setProject] = useState<Project | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [report, setReport] = useState<ProjectReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setErr(null)
    setLoading(true)
    try {
      const p = await api.getProject(projectId)
      setProject(p)
      if (!p) {
        setPhases([])
        setVendors([])
        setInvoices([])
        setPayments([])
        setDocuments([])
        setReport(null)
        return
      }
      const [ph, v, inv, pay, doc] = await Promise.all([
        api.listPhases(projectId),
        api.listVendors(projectId),
        api.listInvoices(projectId),
        api.listPayments(projectId),
        api.listDocuments(projectId),
      ])
      setPhases(ph)
      setVendors(v)
      setInvoices(inv)
      setPayments(pay)
      setDocuments(doc)
      const r = await api.getProjectReport(projectId)
      setReport(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const vendorName = useMemo(() => {
    const m = new Map<string, string>()
    vendors.forEach((v) => m.set(v.id, v.name))
    return m
  }, [vendors])

  if (!projectId) {
    return <p className="text-sm text-slate-600">Missing project.</p>
  }

  if (loading && !project) {
    return <p className="text-sm text-slate-600">Loading…</p>
  }

  if (!project) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Project not found.{' '}
        <Link className="font-medium underline" to="/projects">
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl print:max-w-none">
      <div className="print:hidden">
        <Link
          to="/projects"
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          ← All projects
        </Link>
      </div>

      <header className="mt-4 flex flex-col gap-4 border-b border-slate-200 pb-6 print:hidden md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          {project.location && (
            <p className="mt-1 text-sm text-slate-500">{project.location}</p>
          )}
        </div>
        <button
          type="button"
          className="self-start rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
          onClick={() => {
            if (
              !confirm(
                'Delete this project and all phases, vendors, invoices, payments, and documents?',
              )
            )
              return
            void (async () => {
              try {
                await api.deleteProject(projectId)
                navigate('/projects')
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Delete failed.')
              }
            })()
          }}
        >
          Delete project
        </button>
      </header>

      {err && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 print:hidden">
          {err}
        </p>
      )}

      <nav className="mt-6 flex flex-wrap gap-2 print:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              tab === t.id
                ? 'bg-teal-600 text-white shadow'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === 'overview' && (
          <OverviewTab
            project={project}
            onSaved={async (patch) => {
              const updated = await api.updateProject(projectId, patch)
              setProject(updated)
            }}
          />
        )}
        {tab === 'phases' && (
          <PhasesTab
            projectId={projectId}
            phases={phases}
            onRefresh={load}
            onError={setErr}
          />
        )}
        {tab === 'vendors' && (
          <VendorsTab
            projectId={projectId}
            vendors={vendors}
            invoices={invoices}
            payments={payments}
            vendorName={vendorName}
            onRefresh={load}
            onError={setErr}
          />
        )}
        {tab === 'documents' && (
          <DocumentsTab
            projectId={projectId}
            documents={documents}
            vendors={vendors}
            invoices={invoices}
            payments={payments}
            onRefresh={load}
            onError={setErr}
          />
        )}
        {tab === 'reports' && report && (
          <ReportsTab report={report} vendorName={vendorName} />
        )}
      </div>
    </div>
  )
}

function OverviewTab({
  project,
  onSaved,
}: {
  project: Project
  onSaved: (patch: Partial<Pick<Project, 'name' | 'description' | 'location' | 'status'>>) => Promise<void>
}) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [location, setLocation] = useState(project.location ?? '')
  const [status, setStatus] = useState(project.status)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(project.name)
    setDescription(project.description)
    setLocation(project.location ?? '')
    setStatus(project.status)
  }, [project])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-medium text-slate-900">Project details</h2>
      <form
        className="mt-4 grid max-w-xl gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setSaving(true)
          try {
            await onSaved({ name, description, location, status })
          } finally {
            setSaving(false)
          }
        }}
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Name</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Description</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Location</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>
        <label className="block max-w-xs">
          <span className="text-xs font-medium text-slate-600">Status</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          >
            {projectStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="w-fit rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}

function PhasesTab({
  projectId,
  phases,
  onRefresh,
  onError,
}: {
  projectId: string
  phases: Phase[]
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
}) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [desc, setDesc] = useState('')

  return (
    <div className="space-y-8">
      <form
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || !start || !end) return
          onError(null)
          try {
            await api.createPhase({
              projectId,
              name,
              description: desc || undefined,
              startDate: start,
              endDate: end,
            })
            setName('')
            setDesc('')
            await onRefresh()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not add phase.')
          }
        }}
      >
        <h2 className="text-lg font-medium text-slate-900">Add phase / task</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Name</span>
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Foundation & substructure"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Start</span>
            <input
              required
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">End</span>
            <input
              required
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">
              Notes (optional)
            </span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Add phase
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {phases.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No phases yet.
                </td>
              </tr>
            ) : (
              phases.map((ph) => (
                <PhaseRow
                  key={ph.id}
                  projectId={projectId}
                  phase={ph}
                  onRefresh={onRefresh}
                  onError={onError}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PhaseRow({
  projectId,
  phase,
  onRefresh,
  onError,
}: {
  projectId: string
  phase: Phase
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-4 py-3 font-medium text-slate-900">{phase.name}</td>
      <td className="px-4 py-3 text-slate-600">{formatDate(phase.startDate)}</td>
      <td className="px-4 py-3 text-slate-600">{formatDate(phase.endDate)}</td>
      <td className="px-4 py-3">
        <select
          className="rounded border border-slate-200 px-2 py-1 text-xs"
          value={phase.status}
          onChange={(e) => {
            const v = e.target.value as PhaseStatus
            void (async () => {
              try {
                await api.updatePhase(phase.id, { status: v }, projectId)
                await onRefresh()
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Update failed.')
              }
            })()
          }}
        >
          {phaseStatusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          className="text-xs text-red-600 hover:underline"
          onClick={() => {
            if (!confirm('Delete this phase?')) return
            void (async () => {
              try {
                await api.deletePhase(phase.id, projectId)
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
}

function VendorsTab({
  projectId,
  vendors,
  invoices,
  payments,
  vendorName,
  onRefresh,
  onError,
}: {
  projectId: string
  vendors: Vendor[]
  invoices: Invoice[]
  payments: Payment[]
  vendorName: Map<string, string>
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
}) {
  const [vName, setVName] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [invVendor, setInvVendor] = useState('')
  const [invNo, setInvNo] = useState('')
  const [invAmount, setInvAmount] = useState('')
  const [invIssued, setInvIssued] = useState('')
  const [invDue, setInvDue] = useState('')

  const [payInvoice, setPayInvoice] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payRef, setPayRef] = useState('')

  const invoicesById = useMemo(() => {
    const m = new Map<string, Invoice>()
    invoices.forEach((i) => m.set(i.id, i))
    return m
  }, [invoices])

  return (
    <div className="space-y-10">
      <form
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!vName.trim()) return
          onError(null)
          try {
            await api.createVendor({
              projectId,
              name: vName,
              contactName: contact || undefined,
              email: email || undefined,
              phone: phone || undefined,
            })
            setVName('')
            setContact('')
            setEmail('')
            setPhone('')
            await onRefresh()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not add vendor.')
          }
        }}
      >
        <h2 className="text-lg font-medium text-slate-900">Add vendor</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Name</span>
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={vName}
              onChange={(e) => setVName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Contact</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Email</span>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Phone</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Save vendor
        </button>
      </form>

      <section>
        <h2 className="text-lg font-medium text-slate-900">Vendors</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No vendors yet.
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.contactName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.email ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          if (!confirm('Delete vendor and related invoice links?'))
                            return
                          void (async () => {
                            try {
                              await api.deleteVendor(v.id, projectId)
                              await onRefresh()
                            } catch (err) {
                              onError(
                                err instanceof Error ? err.message : 'Delete failed.',
                              )
                            }
                          })()
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <form
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!invVendor || !invNo.trim() || !invAmount || !invIssued) return
          onError(null)
          try {
            await api.createInvoice({
              projectId,
              vendorId: invVendor,
              invoiceNumber: invNo,
              amount: Number(invAmount),
              issuedDate: invIssued,
              dueDate: invDue || undefined,
            })
            setInvNo('')
            setInvAmount('')
            setInvDue('')
            await onRefresh()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not add invoice.')
          }
        }}
      >
        <h2 className="text-lg font-medium text-slate-900">Record invoice</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Vendor</span>
            <select
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={invVendor}
              onChange={(e) => setInvVendor(e.target.value)}
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Invoice #</span>
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={invNo}
              onChange={(e) => setInvNo(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Amount</span>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={invAmount}
              onChange={(e) => setInvAmount(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Issued</span>
            <input
              required
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={invIssued}
              onChange={(e) => setInvIssued(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Due (optional)</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={invDue}
              onChange={(e) => setInvDue(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Add invoice
        </button>
      </form>

      <form
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!payInvoice || !payAmount || !payDate) return
          onError(null)
          try {
            await api.createPayment({
              projectId,
              invoiceId: payInvoice,
              amount: Number(payAmount),
              paidDate: payDate,
              reference: payRef || undefined,
            })
            setPayAmount('')
            setPayRef('')
            await onRefresh()
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not add payment.')
          }
        }}
      >
        <h2 className="text-lg font-medium text-slate-900">Record payment</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Invoice</span>
            <select
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payInvoice}
              onChange={(e) => setPayInvoice(e.target.value)}
            >
              <option value="">Select invoice</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} — {vendorName.get(i.vendorId) ?? 'Vendor'} —{' '}
                  {formatMoney(i.amount, i.currency)} ({i.status})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Amount</span>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Paid on</span>
            <input
              required
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">
              Reference (optional)
            </span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Add payment
        </button>
      </form>

      <section>
        <h2 className="text-lg font-medium text-slate-900">Invoices</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No invoices.
                  </td>
                </tr>
              ) : (
                invoices.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{i.invoiceNumber}</td>
                    <td className="px-4 py-3">{vendorName.get(i.vendorId) ?? '—'}</td>
                    <td className="px-4 py-3">{formatMoney(i.amount, i.currency)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(i.issuedDate)}
                    </td>
                    <td className="px-4 py-3 capitalize">{i.status.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          if (!confirm('Delete this invoice?')) return
                          void (async () => {
                            try {
                              await api.deleteInvoice(i.id, projectId)
                              await onRefresh()
                            } catch (err) {
                              onError(
                                err instanceof Error ? err.message : 'Delete failed.',
                              )
                            }
                          })()
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-900">Payments</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No payments.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const inv = invoicesById.get(p.invoiceId)
                  return (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="px-4 py-3">{formatDate(p.paidDate)}</td>
                      <td className="px-4 py-3">
                        {vendorName.get(p.vendorId) ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {inv?.invoiceNumber ?? p.invoiceId}
                      </td>
                      <td className="px-4 py-3">
                        {inv
                          ? formatMoney(p.amount, inv.currency)
                          : formatMoney(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.reference ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => {
                            if (!confirm('Delete this payment?')) return
                            void (async () => {
                              try {
                                await api.deletePayment(p.id, projectId)
                                await onRefresh()
                              } catch (err) {
                                onError(
                                  err instanceof Error ? err.message : 'Delete failed.',
                                )
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
      </section>
    </div>
  )
}

function DocumentsTab({
  projectId,
  documents,
  vendors,
  invoices,
  payments,
  onRefresh,
  onError,
}: {
  projectId: string
  documents: ProjectDocument[]
  vendors: Vendor[]
  invoices: Invoice[]
  payments: Payment[]
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
}) {
  const [kind, setKind] = useState<DocumentKind>('invoice')
  const [vendorId, setVendorId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [file, setFile] = useState<File | null>(null)

  return (
    <div className="space-y-6">
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
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => {
                        if (!confirm('Remove this document?')) return
                        void (async () => {
                          try {
                            await api.deleteDocument(d.id, projectId)
                            await onRefresh()
                          } catch (err) {
                            onError(
                              err instanceof Error ? err.message : 'Delete failed.',
                            )
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

function ReportsTab({
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
