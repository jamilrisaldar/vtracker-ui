import { useEffect, useState } from 'react'
import type { Project, ProjectStatus } from '../../types'
import { projectStatusOptions } from './constants'

export function OverviewTab({
  project,
  onSaved,
  readOnly = false,
}: {
  project: Project
  onSaved: (
    patch: Partial<Pick<Project, 'name' | 'description' | 'location' | 'status'>>,
  ) => Promise<void>
  readOnly?: boolean
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
          if (readOnly) return
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
            readOnly={readOnly}
            disabled={readOnly}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Description</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            readOnly={readOnly}
            disabled={readOnly}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Location</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            readOnly={readOnly}
            disabled={readOnly}
          />
        </label>
        <label className="block max-w-xs">
          <span className="text-xs font-medium text-slate-600">Status</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            disabled={readOnly}
          >
            {projectStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {!readOnly ? (
          <button
            type="submit"
            disabled={saving}
            className="w-fit rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        ) : (
          <p className="text-xs text-slate-500">You have read-only access to this project.</p>
        )}
      </form>
    </div>
  )
}
