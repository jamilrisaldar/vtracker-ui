import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthSession } from '../types'
import * as authService from '../api/authService'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    const s = await authService.getSession()
    setSession(s)
  }, [])

  useEffect(() => {
    let cancelled = false
    void authService.getSession().then((s) => {
      if (cancelled) return
      setSession(s)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const loginWithCredential = useCallback(async (credential: string) => {
    const s = await authService.loginWithGoogleCredential(credential)
    setSession(s)
  }, [])

  const loginMockGoogle = useCallback(async () => {
    const s = await authService.loginWithMockGoogle()
    setSession(s)
  }, [])

  const loginWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      const s = await authService.loginWithEmailPassword(email, password)
      setSession(s)
    },
    [],
  )

  const logout = useCallback(async () => {
    await authService.logout()
    setSession(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      user: session?.user ?? null,
      loginWithCredential,
      loginMockGoogle,
      loginWithEmailPassword,
      logout,
      refreshSession,
    }),
    [
      session,
      loading,
      loginWithCredential,
      loginMockGoogle,
      loginWithEmailPassword,
      logout,
      refreshSession,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
