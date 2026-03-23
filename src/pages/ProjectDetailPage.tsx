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
import { PhaseAddEditPanel } from '../components/PhaseAddEditPanel'
import { VendorAddPanel } from '../components/VendorAddPanel'
import { InvoiceRecordPanel } from '../components/InvoiceRecordPanel'
import { PaymentRecordPanel } from '../components/PaymentRecordPanel'

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
  const [reordering, setReordering] = useState(false)
  const [panelMode, setPanelMode] = useState<'add' | 'edit' | null>(null)
  const [panelPhase, setPanelPhase] = useState<Phase | null>(null)

  const openAdd = () => {
    if (reordering) return
    setPanelPhase(null)
    setPanelMode('add')
  }

  const openEdit = (phase: Phase) => {
    if (reordering) return
    setPanelPhase(phase)
    setPanelMode('edit')
  }

  const closePanel = () => {
    setPanelMode(null)
    setPanelPhase(null)
  }

  const sortedPhases = useMemo(
    () =>
      [...phases].sort(
        (a, b) =>
          a.displayOrder - b.displayOrder ||
          a.startDate.localeCompare(b.startDate),
      ),
    [phases],
  )

  function addDaysToIsoDate(dateStr: string, days: number): string {
    const base = new Date(`${dateStr}T00:00:00Z`)
    if (Number.isNaN(base.getTime())) return dateStr
    base.setUTCDate(base.getUTCDate() + days)
    return base.toISOString().slice(0, 10)
  }

  const nextDefaultStartDate = useMemo(() => {
    if (sortedPhases.length === 0) return undefined
    const last = sortedPhases[sortedPhases.length - 1]
    if (!last.endDate) return undefined
    return addDaysToIsoDate(last.endDate, 1)
  }, [sortedPhases])

  const actionsDisabled = reordering || panelMode !== null

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={reordering}
          onClick={openAdd}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          Add phase
        </button>
      </div>

      {panelMode !== null && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40"
          aria-hidden="true"
        >
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            <PhaseAddEditPanel
              mode={panelMode}
              projectId={projectId}
              phase={panelMode === 'edit' ? panelPhase ?? undefined : undefined}
              onClose={closePanel}
              onRefresh={onRefresh}
              onError={onError}
              disabled={reordering}
              defaultStartDate={panelMode === 'add' ? nextDefaultStartDate : undefined}
              className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-px whitespace-nowrap px-2 py-3" scope="col">
                Order
              </th>
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
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No phases yet.
                </td>
              </tr>
            ) : (
              sortedPhases.map((ph) => (
                <PhaseRow
                  key={ph.id}
                  projectId={projectId}
                  phase={ph}
                  sortedPhases={sortedPhases}
                  reordering={reordering}
                  setReordering={setReordering}
                  onRefresh={onRefresh}
                  onError={onError}
                  onEdit={openEdit}
                  actionsDisabled={actionsDisabled}
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
  sortedPhases,
  reordering,
  setReordering,
  onRefresh,
  onError,
  onEdit,
  actionsDisabled,
}: {
  projectId: string
  phase: Phase
  sortedPhases: Phase[]
  reordering: boolean
  setReordering: (v: boolean) => void
  onRefresh: () => Promise<void>
  onError: (msg: string | null) => void
  onEdit: (phase: Phase) => void
  actionsDisabled: boolean
}) {
  const rowIndex = sortedPhases.findIndex((p) => p.id === phase.id)
  const canMoveUp = rowIndex > 0
  const canMoveDown = rowIndex >= 0 && rowIndex < sortedPhases.length - 1

  async function movePhase(direction: 'up' | 'down') {
    if (rowIndex < 0) return
    const swapWith = direction === 'up' ? rowIndex - 1 : rowIndex + 1
    if (swapWith < 0 || swapWith >= sortedPhases.length) return
    const a = sortedPhases[rowIndex]
    const b = sortedPhases[swapWith]
    const aOrder = a.displayOrder
    const bOrder = b.displayOrder
    setReordering(true)
    onError(null)
    try {
      await api.updatePhase(a.id, { displayOrder: bOrder }, projectId)
      await api.updatePhase(b.id, { displayOrder: aOrder }, projectId)
      await onRefresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Reorder failed.')
    } finally {
      setReordering(false)
    }
  }

  return (
    <tr className="border-b border-slate-100">
      <td className="px-2 py-2 align-middle">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            title="Move up"
            disabled={!canMoveUp || reordering || actionsDisabled}
            onClick={() => void movePhase('up')}
            className="rounded border border-slate-200 bg-white p-0.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 5.293l-6 6 1.414 1.414L10 8.12l4.586 4.586L16 11.293l-6-6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            type="button"
            title="Move down"
            disabled={!canMoveDown || reordering || actionsDisabled}
            onClick={() => void movePhase('down')}
            className="rounded border border-slate-200 bg-white p-0.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 14.707l6-6-1.414-1.414L10 11.88 5.414 7.293 4 8.707l6 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </td>
      <td className="px-4 py-3 font-medium text-slate-900">{phase.name}</td>
      <td className="px-4 py-3 text-slate-600">{formatDate(phase.startDate)}</td>
      <td className="px-4 py-3 text-slate-600">{formatDate(phase.endDate)}</td>
      <td className="px-4 py-3">
        <select
          className="rounded border border-slate-200 px-2 py-1 text-xs"
          value={phase.status}
          disabled={reordering || actionsDisabled}
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
        <div className="flex items-center justify-end gap-4">
          <button
          type="button"
          disabled={actionsDisabled}
          className="text-xs text-teal-700 hover:underline disabled:opacity-40"
          onClick={() => onEdit(phase)}
        >
          Edit
          </button>
          <button
            type="button"
            disabled={reordering || actionsDisabled}
            className="text-xs text-red-600 hover:underline disabled:opacity-40"
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
        </div>
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
  const [panelMode, setPanelMode] = useState<'vendor' | 'invoice' | 'payment' | null>(null)
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [displayInvoices, setDisplayInvoices] = useState<Invoice[]>(invoices)
  const [displayPayments, setDisplayPayments] = useState<Payment[]>(payments)

  const invoicesById = useMemo(() => {
    const m = new Map<string, Invoice>()
    displayInvoices.forEach((i) => m.set(i.id, i))
    return m
  }, [displayInvoices])

  useEffect(() => {
    if (!selectedVendorId) {
      setDisplayInvoices(invoices)
      setDisplayPayments(payments)
    }
  }, [invoices, payments, selectedVendorId])

  useEffect(() => {
    let ignore = false
    if (!selectedVendorId) return
    void (async () => {
      try {
        onError(null)
        const [inv, pay] = await Promise.all([
          api.listInvoicesByVendor(projectId, selectedVendorId),
          api.listPaymentsByVendor(projectId, selectedVendorId),
        ])
        if (ignore) return
        setDisplayInvoices(inv)
        setDisplayPayments(pay)
      } catch (err) {
        if (ignore) return
        onError(err instanceof Error ? err.message : 'Could not filter vendor data.')
      }
    })()
    return () => {
      ignore = true
    }
  }, [projectId, selectedVendorId, onError])

  return (
    <div className="space-y-10">
      {panelMode !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl">
            {panelMode === 'vendor' ? (
              <VendorAddPanel
                projectId={projectId}
                onClose={() => setPanelMode(null)}
                onRefresh={onRefresh}
                onError={onError}
                className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
              />
            ) : panelMode === 'invoice' ? (
              <InvoiceRecordPanel
                projectId={projectId}
                vendors={vendors}
                onClose={() => setPanelMode(null)}
                onRefresh={onRefresh}
                onError={onError}
                className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
              />
            ) : (
              <PaymentRecordPanel
                projectId={projectId}
                invoices={selectedVendorId ? displayInvoices : invoices}
                vendorName={vendorName}
                onClose={() => setPanelMode(null)}
                onRefresh={onRefresh}
                onError={onError}
                className="h-full overflow-y-auto rounded-none border-y-0 border-r-0 p-6 shadow-xl"
              />
            )}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium text-slate-900">Vendors</h2>
            {selectedVendorId && (
              <button
                type="button"
                onClick={() => setSelectedVendorId(null)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Show all
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPanelMode('vendor')}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Add vendor
          </button>
        </div>
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
                  <tr
                    key={v.id}
                    className={[
                      'border-b border-slate-100 cursor-pointer',
                      selectedVendorId === v.id ? 'bg-teal-50' : 'hover:bg-slate-50',
                    ].join(' ')}
                    onClick={() =>
                      setSelectedVendorId((curr) => (curr === v.id ? null : v.id))
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.contactName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.email ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!confirm('Delete vendor and related invoice links?'))
                            return
                          void (async () => {
                            try {
                              await api.deleteVendor(v.id, projectId)
                              if (selectedVendorId === v.id) setSelectedVendorId(null)
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">Invoices</h2>
          <button
            type="button"
            onClick={() => setPanelMode('invoice')}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Record invoice
          </button>
        </div>
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
              {displayInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No invoices.
                  </td>
                </tr>
              ) : (
                displayInvoices.map((i) => (
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">Payments</h2>
          <button
            type="button"
            onClick={() => setPanelMode('payment')}
            className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900"
          >
            Record payment
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Partial</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Comments</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displayPayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                    No payments.
                  </td>
                </tr>
              ) : (
                displayPayments.map((p) => {
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
                        {p.paymentMethod ?? p.method ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.isPaymentPartial ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.paymentSource ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.reference ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.comments ?? '—'}
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
