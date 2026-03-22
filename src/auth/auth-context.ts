import { createContext } from 'react'
import type { AuthSession, User } from '../types'

export type AuthState = {
  session: AuthSession | null
  loading: boolean
  user: User | null
  loginWithCredential: (credential: string) => Promise<void>
  loginMockGoogle: () => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
