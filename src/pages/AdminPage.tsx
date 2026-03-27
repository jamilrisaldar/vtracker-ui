import { useCallback, useEffect, useState } from 'react'
import * as adminApi from '../api/backendAdminApi'
import type { AdminRole, AdminUserRow } from '../api/backendAdminApi'
import { useAuth } from '../auth/useAuth'

export function AdminPage() {
  const { user, refreshSession } = useAuth()
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRoleIds, setNewRoleIds] = useState<number[]>([])
  const [createBusy, setCreateBusy] = useState(false)

  const [editUser, setEditUser] = useState<AdminUserRow | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRoleIds, setEditRoleIds] = useState<number[]>([])
  const [editBusy, setEditBusy] = useState(false)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [r, u] = await Promise.all([adminApi.adminListRoles(), adminApi.adminListUsers()])
      setRoles(r)
      setUsers(u)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load admin data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const currentId = user?.id ? Number(user.id) : NaN

  function toggleRoleId(list: number[], id: number, on: boolean): number[] {
    const set = new Set(list)
    if (on) set.add(id)
    else set.delete(id)
    return [...set].sort((a, b) => a - b)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-900">Administration</h1>
      <p className="mt-1 text-sm text-slate-600">
        Create users and assign roles. At least one user must always have the Administrator role.
      </p>

      {err && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
          onClick={() => {
            setCreateOpen(true)
            setNewEmail('')
            setNewPassword('')
            setNewRoleIds([])
          }}
        >
          New user
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-600">Loading…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[0.65rem] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Roles</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{u.email}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {u.roles.length === 0 ? '—' : u.roles.map((r) => r.name).join(', ')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      className="mr-2 text-teal-700 hover:underline"
                      onClick={() => {
                        setEditUser(u)
                        setEditEmail(u.email)
                        setEditPassword('')
                        setEditRoleIds(u.roles.map((r) => r.id))
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline disabled:opacity-40"
                      disabled={u.id === currentId}
                      title={u.id === currentId ? 'Cannot delete your own account' : undefined}
                      onClick={() => {
                        if (!window.confirm(`Delete user ${u.email}?`)) return
                        void (async () => {
                          setErr(null)
                          try {
                            await adminApi.adminDeleteUser(u.id)
                            await load()
                            if (u.id === currentId) {
                              await refreshSession()
                            }
                          } catch (e) {
                            setErr(e instanceof Error ? e.message : 'Delete failed.')
                          }
                        })()
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-create-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="admin-create-title" className="text-lg font-medium text-slate-900">
              New user
            </h3>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Email</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-600">Password (min 8 characters)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-slate-600">Roles</legend>
              <div className="mt-2 space-y-2">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newRoleIds.includes(r.id)}
                      onChange={(e) => setNewRoleIds(toggleRoleId(newRoleIds, r.id, e.target.checked))}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={
                  createBusy ||
                  !newEmail.trim() ||
                  newPassword.length < 8 ||
                  newRoleIds.length === 0
                }
                onClick={() => {
                  setCreateBusy(true)
                  setErr(null)
                  void (async () => {
                    try {
                      await adminApi.adminCreateUser({
                        email: newEmail.trim(),
                        password: newPassword,
                        roleIds: newRoleIds,
                      })
                      setCreateOpen(false)
                      await load()
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : 'Create failed.')
                    } finally {
                      setCreateBusy(false)
                    }
                  })()
                }}
              >
                {createBusy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editUser ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-edit-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="admin-edit-title" className="text-lg font-medium text-slate-900">
              Edit user
            </h3>
            <p className="mt-1 text-xs text-slate-500">{editUser.email}</p>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-600">Email</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-600">New password (leave blank to keep)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-slate-600">Roles</legend>
              <div className="mt-2 space-y-2">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editRoleIds.includes(r.id)}
                      onChange={(e) => setEditRoleIds(toggleRoleId(editRoleIds, r.id, e.target.checked))}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                onClick={() => setEditUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={
                  editBusy ||
                  !editEmail.trim() ||
                  editRoleIds.length === 0 ||
                  (editPassword.length > 0 && editPassword.length < 8)
                }
                onClick={() => {
                  setEditBusy(true)
                  setErr(null)
                  void (async () => {
                    try {
                      const patch: { email?: string; password?: string; roleIds?: number[] } = {
                        email: editEmail.trim(),
                        roleIds: editRoleIds,
                      }
                      if (editPassword.length > 0) {
                        patch.password = editPassword
                      }
                      await adminApi.adminUpdateUser(editUser.id, patch)
                      setEditUser(null)
                      await load()
                      if (editUser.id === currentId) {
                        await refreshSession()
                      }
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : 'Update failed.')
                    } finally {
                      setEditBusy(false)
                    }
                  })()
                }}
              >
                {editBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
