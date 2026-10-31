/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gas-tracker backend (std-dive-gas-tracker), e.g. http://localhost:8090 */
  readonly VITE_BACKEND_URL: string
  /** Dive-logger ws that issues the access tokens (/api/auth/login, /refresh, /logout) */
  readonly VITE_AUTH_URL: string
  /** The dive logger's sign-up page: accounts are created there. Unset: no link on the login page */
  readonly VITE_SIGNUP_URL?: string
  /** "true" only for local development: shows the dev-login form (backend profile dev-login) */
  readonly VITE_DEV_LOGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
