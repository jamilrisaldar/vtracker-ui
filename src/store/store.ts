import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from './slices/authSlice'

/** App-wide store. Add slices here (e.g. `projects`, `ui`) as features grow. */
export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
