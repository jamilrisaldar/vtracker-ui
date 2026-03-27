import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { User } from '../types'
import { useAuth } from './useAuth'

export function RoleRoute({
  children,
  allow,
  /** When set and `allow` fails, navigate here (e.g. send non-admins away from `/accounts`). */
  redirectTo,
}: {
  children: ReactNode
  allow: (user: User) => boolean
  redirectTo?: string
}) {
  const { loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-teal-600 border-t-transparent"
            aria-hidden
          />
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!allow(user)) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />
    }
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-medium">Access denied</p>
        <p className="mt-2 text-amber-800">
          Your account does not have permission to view this area. Contact an administrator if you need access.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
