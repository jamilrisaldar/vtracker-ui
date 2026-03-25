import { configureStore } from '@reduxjs/toolkit'
import { accountsPageReducer } from './slices/accountsPageSlice'
import { authReducer } from './slices/authSlice'
import { projectDetailReducer } from './slices/projectDetailSlice'

/** App-wide store. Add slices here (e.g. `projects`, `ui`) as features grow. */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    projectDetail: projectDetailReducer,
    accountsPage: accountsPageReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
