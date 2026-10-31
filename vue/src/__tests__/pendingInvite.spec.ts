import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { pendingInvite, rememberInvite } from '@/lib/utils/pendingInvite'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/lib/globals/auth/refreshToken', () => ({
  devLogin: vi.fn(),
  logoutOnServer: vi.fn(),
  refreshAccessToken: vi.fn().mockResolvedValue({ kind: 'unauthorized' }),
}))

const currentPath = () => router.currentRoute.value.fullPath

describe('an invite opened while logged out', () => {
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    await useAuthStore().logout()
    await router.push('/login')
  })

  it('leads to the login and is remembered', async () => {
    await router.push('/join/abc')

    expect(router.currentRoute.value.name).toBe('Login')
    expect(router.currentRoute.value.query.from).toBe('/join/abc')
    expect(pendingInvite()).toBe('abc')
  })

  it('comes back at the next start after a login, even without the original link', async () => {
    rememberInvite('abc')
    useAuthStore().login('token')

    await router.push('/')

    expect(currentPath()).toBe('/join/abc')
  })

  it('is shown once, so "Not now" leads on to the start page', async () => {
    rememberInvite('abc')
    useAuthStore().login('token')
    await router.push('/')

    expect(pendingInvite()).toBeNull()
    await router.push('/teams')
    await router.push('/')

    expect(currentPath()).toBe('/')
  })

  it('is forgotten after using the original link', async () => {
    await router.push('/join/abc')
    useAuthStore().login('token')

    await router.push('/join/abc')

    expect(pendingInvite()).toBeNull()
  })

  it('does not get in the way of another page', async () => {
    rememberInvite('abc')
    useAuthStore().login('token')

    await router.push('/teams')

    expect(currentPath()).toBe('/teams')
    expect(pendingInvite()).toBe('abc')
  })

  it('is forgotten on logout, so the next person on this device does not get it', async () => {
    rememberInvite('abc')
    useAuthStore().login('token')

    await useAuthStore().logout()

    expect(pendingInvite()).toBeNull()
  })

  it('is not remembered when already logged in', async () => {
    useAuthStore().login('token')

    await router.push('/join/abc')

    expect(currentPath()).toBe('/join/abc')
    expect(pendingInvite()).toBeNull()
  })
})
