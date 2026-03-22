/**
 * Unified auth: backend (cookie + CSRF per Swagger) or local mock.
 */
import type { AuthSession } from '../types'
import { isBackendAuthEnabled } from '../config'
import * as backend from './backendAuth'
import * as mockApi from './mockApi'
import { setApiSessionUserId } from './apiAuthState'

export async function getSession(): Promise<AuthSession | null> {
  if (isBackendAuthEnabled()) {
    return backend.getSessionFromApi()
  }
  setApiSessionUserId(null)
  return mockApi.getSession()
}

export async function logout(): Promise<void> {
  if (isBackendAuthEnabled()) {
    await backend.logoutFromApi()
    return
  }
  await mockApi.logout()
}

export async function loginWithGoogleCredential(
  credential: string,
): Promise<AuthSession> {
  if (isBackendAuthEnabled()) {
    throw new Error(
      'Google sign-in is not configured for the API. Use email and password.',
    )
  }
  return mockApi.loginWithGoogleCredential(credential)
}

export async function loginWithMockGoogle(): Promise<AuthSession> {
  if (isBackendAuthEnabled()) {
    throw new Error(
      'Simulated sign-in is disabled while using the real API. Use email and password.',
    )
  }
  return mockApi.loginWithMockGoogle()
}

export async function loginWithEmailPassword(
  email: string,
  password: string,
): Promise<AuthSession> {
  if (!isBackendAuthEnabled()) {
    throw new Error('Email login is only available when the backend API is enabled.')
  }
  return backend.loginWithEmailPassword(email, password)
}
