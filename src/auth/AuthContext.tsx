import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthSession } from '../types'
import * as api from '../api/mockApi'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    const s = await api.getSession()
    setSession(s)
  }, [])

  useEffect(() => {
    let cancelled = false
    void api.getSession().then((s) => {
      if (cancelled) return
      setSession(s)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const loginWithCredential = useCallback(async (credential: string) => {
    const s = await api.loginWithGoogleCredential(credential)
    setSession(s)
  }, [])

  const loginMockGoogle = useCallback(async () => {
    const s = await api.loginWithMockGoogle()
    setSession(s)
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setSession(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      user: session?.user ?? null,
      loginWithCredential,
      loginMockGoogle,
      logout,
      refreshSession,
    }),
    [
      session,
      loading,
      loginWithCredential,
      loginMockGoogle,
      logout,
      refreshSession,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
