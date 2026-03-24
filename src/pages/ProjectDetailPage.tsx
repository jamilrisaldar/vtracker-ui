import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  Invoice,
  LandPlot,
  Payment,
  Phase,
  Project,
  ProjectDocument,
  Vendor,
} from '../types'
import * as api from '../api/dataApi'
import type { ProjectReport } from '../types'
import {
  tabs,
  type TabId,
  OverviewTab,
  PhasesTab,
  PlotsTab,
  VendorsTab,
  DocumentsTab,
  ReportsTab,
} from '../components/project-detail'

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: TabId = tabs.some((t) => t.id === rawTab) ? (rawTab as TabId) : 'overview'
  const setTab = (t: TabId) => {
    setSearchParams({ tab: t }, { replace: true })
  }

  const [project, setProject] = useState<Project | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [plots, setPlots] = useState<LandPlot[]>([])
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
        setPlots([])
        setVendors([])
        setInvoices([])
        setPayments([])
        setDocuments([])
        setReport(null)
        return
      }
      const [ph, pl, v, inv, pay, doc] = await Promise.all([
        api.listPhases(projectId),
        api.listPlots(projectId),
        api.listVendors(projectId),
        api.listInvoices(projectId),
        api.listPayments(projectId),
        api.listDocuments(projectId),
      ])
      setPhases(ph)
      setPlots(pl)
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
                'Delete this project and all phases, plots, vendors, invoices, payments, and documents?',
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
        {tab === 'plots' && (
          <PlotsTab
            projectId={projectId}
            plots={plots}
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
