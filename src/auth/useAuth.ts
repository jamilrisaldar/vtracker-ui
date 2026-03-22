import { useCallback, useMemo } from 'react'
import type { AuthSession, User } from '../types'
import {
  hydrateAuth,
  loginWithEmailPasswordThunk,
  loginWithGoogleCredentialThunk,
  loginWithMockGoogleThunk,
  logoutThunk,
} from '../store/slices/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

export type AuthHookValue = {
  session: AuthSession | null
  loading: boolean
  user: User | null
  loginWithCredential: (credential: string) => Promise<void>
  loginMockGoogle: () => Promise<void>
  loginWithEmailPassword: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Re-fetch session (e.g. after profile changes). Use sparingly to avoid redundant API calls. */
  refreshSession: () => Promise<void>
}

export function useAuth(): AuthHookValue {
  const dispatch = useAppDispatch()
  const session = useAppSelector((s) => s.auth.session)
  const status = useAppSelector((s) => s.auth.status)

  const loading = status !== 'ready'

  const loginWithCredential = useCallback(
    async (credential: string) => {
      await dispatch(loginWithGoogleCredentialThunk(credential)).unwrap()
    },
    [dispatch],
  )

  const loginMockGoogle = useCallback(async () => {
    await dispatch(loginWithMockGoogleThunk()).unwrap()
  }, [dispatch])

  const loginWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      await dispatch(loginWithEmailPasswordThunk({ email, password })).unwrap()
    },
    [dispatch],
  )

  const logout = useCallback(async () => {
    await dispatch(logoutThunk()).unwrap()
  }, [dispatch])

  const refreshSession = useCallback(async () => {
    await dispatch(hydrateAuth()).unwrap()
  }, [dispatch])

  return useMemo(
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
}
