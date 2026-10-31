// Read at call time (not module load) so tests can vi.stubEnv() them.
export const backendUrl = (): string => import.meta.env.VITE_BACKEND_URL ?? ''
export const authUrl = (): string => import.meta.env.VITE_AUTH_URL ?? ''
export const signupUrl = (): string => import.meta.env.VITE_SIGNUP_URL ?? ''
export const isDevLoginEnabled = (): boolean => import.meta.env.VITE_DEV_LOGIN === 'true'
