import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const nav = [
  { to: '/projects', label: 'Projects' },
  { to: '/accounts', label: 'Accounts' },
]

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-svh flex-col bg-slate-100 md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:w-56 md:border-b-0 md:border-r md:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:flex-col md:items-stretch">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-700">
              Venture Tracker
            </p>
            <p className="text-sm font-semibold text-slate-900">Build &amp; ops</p>
          </div>
          <nav className="flex gap-1 md:flex-col">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-teal-50 text-teal-900'
                      : 'text-slate-600 hover:bg-slate-50',
                  ].join(' ')
                }
                end
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="hidden border-t border-slate-100 px-4 py-4 md:block">
          {user?.picture && (
            <img
              src={user.picture}
              alt=""
              className="mb-2 h-10 w-10 rounded-full"
            />
          )}
          <p className="truncate text-sm font-medium text-slate-900">
            {user?.name}
          </p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur md:hidden">
          <span className="text-sm font-medium text-slate-800">Menu</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
