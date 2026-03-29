import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { canAccessAdmin, canWriteProjects } from '../auth/roles'
import { useAuth } from '../auth/useAuth'
import type { Project } from '../types'
import * as api from '../api/dataApi'
import {
  tabs,
  type TabId,
  OverviewTab,
  PhasesTab,
  PlotsTab,
  VendorsTab,
  GlTab,
  DocumentsTab,
  ReportsTab,
} from '../components/project-detail'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  ensureTabData,
  fetchDocuments,
  fetchPhases,
  fetchPlots,
  fetchVendorBilling,
  loadProject,
  projectUpdated,
} from '../store/slices/projectDetailSlice'

export function ProjectDetailPage() {
  const { user } = useAuth()
  const readOnly = !canWriteProjects(user)
  const canEditGlChart = canAccessAdmin(user)
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: TabId = tabs.some((t) => t.id === rawTab) ? (rawTab as TabId) : 'overview'
  const setTab = (t: TabId) => {
    setSearchParams({ tab: t }, { replace: true })
  }

  const {
    project,
    phases,
    plots,
    vendors,
    invoices,
    payments,
    documents,
    report,
    status,
    error: loadError,
    reportLoading,
    reportError,
  } = useAppSelector((s) => s.projectDetail)

  const [err, setErr] = useState<string | null>(null)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
  const [deleteProjectNameInput, setDeleteProjectNameInput] = useState('')
  const [deleteProjectBusy, setDeleteProjectBusy] = useState(false)
  useEffect(() => {
    if (!projectId) return
    void dispatch(loadProject(projectId))
  }, [projectId, dispatch])

  useEffect(() => {
    if (!projectId || !project) return
    void dispatch(ensureTabData({ projectId, tab }))
  }, [projectId, tab, project, dispatch])

  const vendorName = useMemo(() => {
    const m = new Map<string, string>()
    vendors.forEach((v) => m.set(v.id, v.name))
    return m
  }, [vendors])

  const refreshPhases = useCallback(async () => {
    if (!projectId) return
    await dispatch(fetchPhases(projectId))
  }, [projectId, dispatch])

  const refreshPlots = useCallback(async () => {
    if (!projectId) return
    await dispatch(fetchPlots(projectId))
  }, [projectId, dispatch])

  const refreshVendorBilling = useCallback(async () => {
    if (!projectId) return
    await dispatch(fetchVendorBilling(projectId))
  }, [projectId, dispatch])

  const refreshDocumentsOnly = useCallback(async () => {
    if (!projectId) return
    await dispatch(fetchDocuments(projectId))
  }, [projectId, dispatch])

  const onOverviewSaved = useCallback(
    async (patch: Partial<Pick<Project, 'name' | 'description' | 'location' | 'status'>>) => {
      if (!projectId) return
      const updated = await api.updateProject(projectId, patch)
      dispatch(projectUpdated(updated))
    },
    [projectId, dispatch],
  )

  if (!projectId) {
    return <p className="text-sm text-slate-600">Missing project.</p>
  }

  if (status === 'loading' && !project) {
    return <p className="text-sm text-slate-600">Loading…</p>
  }

  if (!project) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Project not found.{' '}
        <Link className="font-medium underline" to="/projects">
          Back to projects
        </Link>
        {loadError ? (
          <p className="mt-2 text-amber-800">{loadError}</p>
        ) : null}
      </div>
    )
  }

  const deleteProjectNameOk = deleteProjectNameInput === project.name
  const deleteProjectCanSubmit = deleteProjectNameOk && !deleteProjectBusy

  return (
    <div className="mx-auto max-w-6xl print:max-w-none">
      {deleteProjectOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-project-title" className="text-lg font-medium text-slate-900">
              Delete project
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove this project and all related phases, plots, vendors,
              invoices, payments, and documents. This cannot be undone.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Type the project name exactly as shown below to confirm:
            </p>
            <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-900">
              {project.name}
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Project name</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={deleteProjectNameInput}
                onChange={(e) => setDeleteProjectNameInput(e.target.value)}
                placeholder={project.name}
                autoComplete="off"
                autoFocus
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={deleteProjectBusy}
                onClick={() => {
                  setDeleteProjectOpen(false)
                  setDeleteProjectNameInput('')
                  setDeleteProjectBusy(false)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={!deleteProjectCanSubmit}
                onClick={() => {
                  if (!deleteProjectCanSubmit) return
                  setDeleteProjectBusy(true)
                  setErr(null)
                  void (async () => {
                    try {
                      await api.deleteProject(projectId)
                      navigate('/projects')
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : 'Delete failed.')
                      setDeleteProjectBusy(false)
                    }
                  })()
                }}
              >
                {deleteProjectBusy ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            onClick={() => setTab('gl')}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            General ledger
          </button>
          {!readOnly ? (
            <button
              type="button"
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
              onClick={() => {
                setDeleteProjectNameInput('')
                setDeleteProjectOpen(true)
              }}
            >
              Delete project
            </button>
          ) : null}
        </div>
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
          <OverviewTab project={project} onSaved={onOverviewSaved} readOnly={readOnly} />
        )}
        {tab === 'phases' && (
          <PhasesTab
            projectId={projectId}
            phases={phases}
            onRefresh={refreshPhases}
            onError={setErr}
            readOnly={readOnly}
          />
        )}
        {tab === 'plots' && (
          <PlotsTab
            projectId={projectId}
            projectName={project.name}
            plots={plots}
            onRefresh={refreshPlots}
            onError={setErr}
            readOnly={readOnly}
          />
        )}
        {tab === 'vendors' && (
          <VendorsTab
            projectId={projectId}
            vendors={vendors}
            invoices={invoices}
            payments={payments}
            vendorName={vendorName}
            onRefresh={refreshVendorBilling}
            onError={setErr}
            readOnly={readOnly}
          />
        )}
        {tab === 'gl' && (
          <GlTab projectId={projectId} onError={setErr} readOnly={readOnly} canEditGlChart={canEditGlChart} />
        )}
        {tab === 'documents' && (
          <DocumentsTab
            projectId={projectId}
            documents={documents}
            vendors={vendors}
            invoices={invoices}
            payments={payments}
            onRefresh={refreshDocumentsOnly}
            onError={setErr}
            readOnly={readOnly}
          />
        )}
        {tab === 'reports' && reportLoading && (
          <p className="text-sm text-slate-600">Loading report…</p>
        )}
        {tab === 'reports' && !reportLoading && reportError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {reportError}
          </p>
        )}
        {tab === 'reports' && !reportLoading && !reportError && report && (
          <ReportsTab report={report} vendorName={vendorName} />
        )}
        {tab === 'reports' && !reportLoading && !reportError && !report && (
          <p className="text-sm text-slate-600">No report data.</p>
        )}
      </div>
    </div>
  )
}
