import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from './slices/authSlice'
import { projectDetailReducer } from './slices/projectDetailSlice'

/** App-wide store. Add slices here (e.g. `projects`, `ui`) as features grow. */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    projectDetail: projectDetailReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
