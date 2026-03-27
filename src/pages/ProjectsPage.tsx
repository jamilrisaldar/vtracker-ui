import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canWriteProjects } from '../auth/roles'
import { useAuth } from '../auth/useAuth'
import type { Project, ProjectStatus } from '../types'
import * as api from '../api/dataApi'
import { formatDate } from '../utils/format'

const statusLabel: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
}

const statusClass: Record<ProjectStatus, string> = {
  planning: 'bg-slate-100 text-slate-800',
  active: 'bg-teal-100 text-teal-900',
  on_hold: 'bg-amber-100 text-amber-900',
  completed: 'bg-emerald-100 text-emerald-900',
}

export function ProjectsPage() {
  const { user } = useAuth()
  const readOnly = !canWriteProjects(user)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')

  const load = useCallback(async () => {
    setErr(null)
    try {
      const list = await api.listProjects()
      setProjects(list)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load projects.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly) return
    if (!name.trim()) return
    setErr(null)
    try {
      await api.createProject({
        name,
        description,
        location: location || undefined,
        status,
      })
      setName('')
      setDescription('')
      setLocation('')
      setStatus('planning')
      setCreating(false)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create project.')
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track phases, vendors, invoices, and payments for each hotel build.
          </p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-teal-700"
          >
            {creating ? 'Close form' : 'New project'}
          </button>
        ) : (
          <p className="text-xs text-slate-500">You have read-only access to projects.</p>
        )}
      </div>

      {err && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </p>
      )}

      {creating && !readOnly && (
        <form
          onSubmit={onCreate}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-medium text-slate-900">Create project</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Name</span>
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Riverside Hotel — Tower A"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">
                Description
              </span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope, milestones, notes…"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">
                Location (optional)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Status</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Save project
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center text-sm text-slate-600">
            {readOnly
              ? 'No projects yet.'
              : 'No projects yet. Create one to start tracking phases and vendors.'}
          </div>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-teal-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[0.9375rem] font-semibold leading-snug text-slate-900">
                      {p.name}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium leading-none ${statusClass[p.status]}`}
                    >
                      {statusLabel[p.status]}
                    </span>
                  </div>
                  {p.location && (
                    <p className="mt-1 text-[0.7rem] leading-tight text-slate-500">{p.location}</p>
                  )}
                  <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-600">
                    {p.description || '—'}
                  </p>
                  <p className="mt-2 text-[0.65rem] text-slate-400">
                    Updated {formatDate(p.updatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
