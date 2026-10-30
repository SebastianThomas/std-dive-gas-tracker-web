import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/lib/globals/auth/refreshToken', () => ({
  refreshAccessToken: vi.fn(),
  logoutOnServer: vi.fn(async () => true),
  devLogin: vi.fn(async () => 'dev.token.value'),
}))

import { logoutOnServer, refreshAccessToken } from '@/lib/globals/auth/refreshToken'
import { DEV_TOKEN_KEY, useAuthStore } from '@/stores/auth'

const refresh = vi.mocked(refreshAccessToken)

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.unstubAllEnvs()
    refresh.mockReset()
  })

  it('logs in when the dive logger refreshes the session', async () => {
    refresh.mockResolvedValue({ kind: 'ok', token: 'a.b.c' })
    const auth = useAuthStore()
    await auth.tryInitialLogin()
    expect(auth.status).toBe('authenticated')
    expect(auth.accessToken).toBe('a.b.c')
  })

  it('ends the session only when the server says no', async () => {
    refresh.mockResolvedValue({ kind: 'unauthorized' })
    const auth = useAuthStore()
    await auth.tryInitialLogin()
    expect(auth.status).toBe('anonymous')
    expect(auth.isLoggedIn).toBe(false)
  })

  it('treats an unreachable token server as unreachable, not as a logout', async () => {
    refresh.mockResolvedValue({ kind: 'unreachable' })
    const auth = useAuthStore()
    await auth.tryInitialLogin()
    expect(auth.status).toBe('unreachable')
  })

  it('shares one refresh between concurrent callers', async () => {
    refresh.mockResolvedValue({ kind: 'ok', token: 'a.b.c' })
    const auth = useAuthStore()
    await Promise.all([auth.refreshToken(), auth.refreshToken()])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('restores a stored dev token only when dev login is enabled', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const token = `x.${btoa(JSON.stringify({ exp })).replace(/=+$/, '')}.y`
    localStorage.setItem(DEV_TOKEN_KEY, token)
    refresh.mockResolvedValue({ kind: 'unauthorized' })

    const prod = useAuthStore()
    await prod.tryInitialLogin()
    expect(prod.isLoggedIn).toBe(false)

    setActivePinia(createPinia())
    localStorage.setItem(DEV_TOKEN_KEY, token)
    vi.stubEnv('VITE_DEV_LOGIN', 'true')
    const dev = useAuthStore()
    await dev.tryInitialLogin()
    expect(dev.accessToken).toBe(token)
  })

  it('drops a dev token the server rejected instead of logging it in again', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const token = `x.${btoa(JSON.stringify({ exp })).replace(/=+$/, '')}.y`
    localStorage.setItem(DEV_TOKEN_KEY, token)
    vi.stubEnv('VITE_DEV_LOGIN', 'true')
    refresh.mockResolvedValue({ kind: 'unauthorized' })
    const auth = useAuthStore()
    await auth.tryInitialLogin()
    const version = auth.sessionVersion

    // a 401 with this token (e.g. the backend restarted with a new dev key) asks for a refresh
    expect(await auth.refreshToken()).toBeNull()
    expect(auth.isLoggedIn).toBe(false)
    expect(localStorage.getItem(DEV_TOKEN_KEY)).toBeNull()
    expect(auth.sessionVersion).toBe(version + 1)
    // nothing stored any more: the next attempt is a normal dive-logger refresh
    expect(await auth.refreshToken()).toBeNull()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('logs out on the dive logger unless it was a dev session', async () => {
    refresh.mockResolvedValue({ kind: 'ok', token: 'a.b.c' })
    const auth = useAuthStore()
    await auth.tryInitialLogin()
    await auth.logout()
    expect(auth.isLoggedIn).toBe(false)
    expect(logoutOnServer).toHaveBeenCalled()
  })
})
