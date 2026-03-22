import { useEffect, useRef, type ReactNode } from 'react'
import { hydrateAuth } from './slices/authSlice'
import { useAppDispatch } from './hooks'

/**
 * Dispatches initial session hydration once (survives React Strict Mode double-mount).
 * Avoids duplicate `/me` or mock session reads on every render.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const didHydrate = useRef(false)

  useEffect(() => {
    if (didHydrate.current) return
    didHydrate.current = true
    void dispatch(hydrateAuth())
  }, [dispatch])

  return children
}
