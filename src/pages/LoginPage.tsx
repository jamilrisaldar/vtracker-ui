import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { googleClientId } from '../config'

export function LoginPage() {
  const { session, loading, loginWithCredential, loginMockGoogle } = useAuth()
  const location = useLocation()
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    '/projects'

  if (!loading && session) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-teal-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-xl backdrop-blur">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            Venture Tracker
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Hotel build projects
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with your Google account. Only registered users can access
            the workspace (first sign-in registers your account in this demo).
          </p>
        </div>

        {err && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {err}
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          {googleClientId ? (
            <GoogleLogin
              onSuccess={async (res) => {
                setErr(null)
                if (!res.credential) {
                  setErr('No credential returned from Google.')
                  return
                }
                setBusy(true)
                try {
                  await loginWithCredential(res.credential)
                } catch (e) {
                  setErr(e instanceof Error ? e.message : 'Sign-in failed.')
                } finally {
                  setBusy(false)
                }
              }}
              onError={() => setErr('Google Sign-In failed.')}
              theme="filled_blue"
              size="large"
              text="continue_with"
              shape="rectangular"
              width={320}
            />
          ) : (
            <p className="text-center text-sm text-slate-600">
              No <code className="rounded bg-slate-100 px-1">VITE_GOOGLE_CLIENT_ID</code>{' '}
              configured. Use simulated sign-in below, or add your OAuth client
              ID to <code className="rounded bg-slate-100 px-1">.env</code>.
            </p>
          )}

          <div className="relative w-full py-2 text-center text-xs text-slate-400">
            <span className="relative z-10 bg-white/95 px-2">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setErr(null)
              setBusy(true)
              try {
                await loginMockGoogle()
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Sign-in failed.')
              } finally {
                setBusy(false)
              }
            }}
            className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {busy ? 'Signing in…' : 'Continue with Google (simulated)'}
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Data is stored locally in your browser via a mock API until you connect
          a real backend.
        </p>
      </div>
    </div>
  )
}
