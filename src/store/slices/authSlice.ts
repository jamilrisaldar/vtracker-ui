import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { AuthSession } from '../../types'
import * as authService from '../../api/authService'

export type AuthStatus = 'uninitialized' | 'loading' | 'ready'

export interface AuthState {
  session: AuthSession | null
  /** `uninitialized` → first hydrate not started; `loading` → hydrate or auth mutation in flight; `ready` → safe to read session (may be null). */
  status: AuthStatus
}

const initialState: AuthState = {
  session: null,
  status: 'uninitialized',
}

export const hydrateAuth = createAsyncThunk(
  'auth/hydrate',
  async () => authService.getSession(),
)

export const loginWithGoogleCredentialThunk = createAsyncThunk(
  'auth/loginGoogle',
  (credential: string) => authService.loginWithGoogleCredential(credential),
)

export const loginWithMockGoogleThunk = createAsyncThunk(
  'auth/loginMockGoogle',
  () => authService.loginWithMockGoogle(),
)

export const loginWithEmailPasswordThunk = createAsyncThunk(
  'auth/loginEmail',
  ({ email, password }: { email: string; password: string }) =>
    authService.loginWithEmailPassword(email, password),
)

export const logoutThunk = createAsyncThunk('auth/logout', () => authService.logout())

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearSession(state) {
      state.session = null
    },
  },
  extraReducers(builder) {
    builder
      .addCase(hydrateAuth.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(hydrateAuth.fulfilled, (state, action) => {
        state.session = action.payload
        state.status = 'ready'
      })
      .addCase(hydrateAuth.rejected, (state) => {
        state.session = null
        state.status = 'ready'
      })
      .addCase(loginWithGoogleCredentialThunk.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(loginWithGoogleCredentialThunk.fulfilled, (state, action) => {
        state.session = action.payload
        state.status = 'ready'
      })
      .addCase(loginWithGoogleCredentialThunk.rejected, (state) => {
        state.status = 'ready'
      })
      .addCase(loginWithMockGoogleThunk.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(loginWithMockGoogleThunk.fulfilled, (state, action) => {
        state.session = action.payload
        state.status = 'ready'
      })
      .addCase(loginWithMockGoogleThunk.rejected, (state) => {
        state.status = 'ready'
      })
      .addCase(loginWithEmailPasswordThunk.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(loginWithEmailPasswordThunk.fulfilled, (state, action) => {
        state.session = action.payload
        state.status = 'ready'
      })
      .addCase(loginWithEmailPasswordThunk.rejected, (state) => {
        state.status = 'ready'
      })
      .addCase(logoutThunk.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.session = null
        state.status = 'ready'
      })
      .addCase(logoutThunk.rejected, (state) => {
        state.status = 'ready'
      })
  },
})

export const { clearSession } = authSlice.actions
export const authReducer = authSlice.reducer
