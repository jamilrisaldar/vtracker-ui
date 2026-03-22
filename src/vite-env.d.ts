/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  /** `true` / `1` = use backend auth (cookie session + CSRF). */
  readonly VITE_USE_BACKEND_AUTH: string
  /** API origin; leave empty to use Vite dev proxy (`/api` → localhost:3001). */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
