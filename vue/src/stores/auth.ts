import { devLogin, logoutOnServer, refreshAccessToken } from '@/lib/globals/auth/refreshToken'
import { isDevLoginEnabled } from '@/lib/globals/constants'
import { isJwtExpired } from '@/lib/utils/jwt'
import { forgetInvite } from '@/lib/utils/pendingInvite'
import { safeLocalStorage } from '@/lib/utils/safeLocalStorage'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

/**
 * Tokens come from the dive logger (login + httpOnly refresh cookie, see API.md "Auth") and live
 * in memory only. `unreachable`: the token server didn't answer - never treated as a logout.
 */
export type SessionStatus = 'checking' | 'authenticated' | 'unreachable' | 'anonymous'

// Dev-login tokens can't be refreshed, so (local dev only) they survive reloads in storage.
export const DEV_TOKEN_KEY = 'gas-dev-access-token'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const status = ref<SessionStatus>('checking')
  const initialCheckDone = ref(false)
  /** Bumped on every login/logout so in-flight requests of an old session are dropped. */
  const sessionVersion = ref(0)
  let refreshPromise: Promise<string | null> | null = null

  const isLoggedIn = computed(() => accessToken.value !== null)
  const usesDevToken = computed(
    () => isDevLoginEnabled() && safeLocalStorage.getItem(DEV_TOKEN_KEY) !== null,
  )

  function login(token: string, options: { devToken?: boolean } = {}) {
    sessionVersion.value++
    refreshPromise = null
    accessToken.value = token
    status.value = 'authenticated'
    initialCheckDone.value = true
    if (options.devToken) safeLocalStorage.setItem(DEV_TOKEN_KEY, token)
  }

  function clearSession() {
    sessionVersion.value++
    refreshPromise = null
    accessToken.value = null
    status.value = 'anonymous'
    initialCheckDone.value = true
    safeLocalStorage.removeItem(DEV_TOKEN_KEY)
  }

  async function logout() {
    const wasDev = usesDevToken.value
    clearSession()
    forgetInvite()
    if (!wasDev) await logoutOnServer()
  }

  async function loginWithDevToken(email: string) {
    login(await devLogin(email), { devToken: true })
  }

  /** A fresh access token, or null (then `status` says why). Concurrent callers share one call. */
  function refreshToken(): Promise<string | null> {
    if (refreshPromise) return refreshPromise
    const version = sessionVersion.value
    // Deferred via then(): the body must not run before `pending` is assigned (finally reads it).
    const pending: Promise<string | null> = Promise.resolve().then(async () => {
      try {
        const stored = isDevLoginEnabled() ? safeLocalStorage.getItem(DEV_TOKEN_KEY) : null
        if (stored !== null) {
          // Expired, or the token just in use (the server rejected it, e.g. a restarted backend
          // with a new dev-login key): logging it in again would loop request → 401 → refresh.
          if (isJwtExpired(stored) || stored === accessToken.value) {
            clearSession()
            return null
          }
          login(stored)
          return stored
        }
        const outcome = await refreshAccessToken()
        if (version !== sessionVersion.value) return null
        if (outcome.kind === 'ok') {
          login(outcome.token)
          return outcome.token
        }
        if (outcome.kind === 'unauthorized') {
          clearSession()
        } else {
          status.value = 'unreachable'
        }
        return null
      } finally {
        initialCheckDone.value = true
        if (refreshPromise === pending) refreshPromise = null
      }
    })
    refreshPromise = pending
    return pending
  }

  function waitForInitialCheck(): Promise<void> {
    if (initialCheckDone.value) return Promise.resolve()
    return new Promise((resolve) => {
      const stop = watch(initialCheckDone, (done) => {
        if (done) {
          stop()
          resolve()
        }
      })
    })
  }

  async function tryInitialLogin() {
    try {
      await refreshToken()
    } catch (err) {
      console.error('Initial token refresh failed', err)
    }
  }

  return {
    accessToken,
    status,
    sessionVersion,
    isLoggedIn,
    usesDevToken,
    login,
    logout,
    loginWithDevToken,
    refreshToken,
    waitForInitialCheck,
    tryInitialLogin,
  }
})
