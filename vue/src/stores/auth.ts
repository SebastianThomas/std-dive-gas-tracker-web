import { devLogin, logoutOnServer, refreshAccessToken } from '@/lib/globals/auth/refreshToken'
import { isDevLoginEnabled } from '@/lib/globals/constants'
import { isJwtExpired, jwtOwner } from '@/lib/utils/jwt'
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
  /** Bumped when another person logs in or out: their pages and in-flight requests are dropped. */
  const sessionVersion = ref(0)
  /** The session ran out with a page open: it stays, its requests wait for the same person's login. */
  const sessionExpired = ref(false)
  let owner: string | null = null
  /** Bumped by every login/logout: a refresh started before it no longer counts. */
  let loginCount = 0
  let refreshPromise: Promise<string | null> | null = null

  const isLoggedIn = computed(() => accessToken.value !== null)
  const usesDevToken = computed(
    () => isDevLoginEnabled() && safeLocalStorage.getItem(DEV_TOKEN_KEY) !== null,
  )

  function login(token: string, options: { devToken?: boolean } = {}) {
    const newOwner = jwtOwner(token)
    if (newOwner !== owner) sessionVersion.value++
    owner = newOwner
    loginCount++
    refreshPromise = null
    accessToken.value = token
    status.value = 'authenticated'
    initialCheckDone.value = true
    sessionExpired.value = false
    if (options.devToken) safeLocalStorage.setItem(DEV_TOKEN_KEY, token)
  }

  function dropTokens() {
    loginCount++
    refreshPromise = null
    accessToken.value = null
    status.value = 'anonymous'
    initialCheckDone.value = true
    safeLocalStorage.removeItem(DEV_TOKEN_KEY)
  }

  function clearSession() {
    sessionVersion.value++
    owner = null
    dropTokens()
    sessionExpired.value = false
  }

  /** The server refused to renew the session: nobody yet is simply logged out. */
  function endSession() {
    if (owner === null) {
      clearSession()
    } else {
      dropTokens()
      sessionExpired.value = true
    }
  }

  /** The token after the login a request is waiting for; null at once without an expired session. */
  function waitForLogin(): Promise<string | null> {
    if (!sessionExpired.value) return Promise.resolve(accessToken.value)
    return new Promise((resolve) => {
      const stop = watch(sessionExpired, () => {
        stop()
        resolve(accessToken.value)
      })
    })
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
    const started = loginCount
    // Deferred via then(): the body must not run before `pending` is assigned (finally reads it).
    const pending: Promise<string | null> = Promise.resolve().then(async () => {
      try {
        const stored = isDevLoginEnabled() ? safeLocalStorage.getItem(DEV_TOKEN_KEY) : null
        if (stored !== null) {
          // Expired, or the token just in use (the server rejected it, e.g. a restarted backend
          // with a new dev-login key): logging it in again would loop request → 401 → refresh.
          if (isJwtExpired(stored) || stored === accessToken.value) {
            endSession()
            return null
          }
          login(stored)
          return stored
        }
        const outcome = await refreshAccessToken()
        if (started !== loginCount) return null
        if (outcome.kind === 'ok') {
          login(outcome.token)
          return outcome.token
        }
        if (outcome.kind === 'unauthorized') {
          endSession()
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
    sessionExpired,
    isLoggedIn,
    usesDevToken,
    login,
    logout,
    loginWithDevToken,
    refreshToken,
    waitForLogin,
    waitForInitialCheck,
    tryInitialLogin,
  }
})
