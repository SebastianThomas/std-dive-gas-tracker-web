import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('@/lib/api/me', () => ({
  useMeApi: () => ({ getMe: () => Promise.resolve({ userId: 1, displayName: 'x', teams: [] }) }),
}))

import AppHeader from '@/components/layout/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'

async function mountHeader(loggedIn: boolean) {
  setActivePinia(createPinia())
  if (loggedIn) useAuthStore().login('token')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'Start', component: { template: '<div />' } }],
  })
  await router.push('/')
  const wrapper = mount(AppHeader, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper.find('[data-testid="account-link"]')
}

describe('AppHeader: account settings', () => {
  afterEach(() => vi.unstubAllEnvs())

  it("links to the dive logger's account settings", async () => {
    vi.stubEnv('VITE_ACCOUNT_URL', 'https://logger.example/profile')
    const link = await mountHeader(true)
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe('https://logger.example/profile')
    expect(link.attributes('aria-label')).toBe('Account settings')
  })

  it('shows no link when logged out', async () => {
    vi.stubEnv('VITE_ACCOUNT_URL', 'https://logger.example/profile')
    expect((await mountHeader(false)).exists()).toBe(false)
  })

  it('shows no link without an account page', async () => {
    vi.stubEnv('VITE_ACCOUNT_URL', '')
    expect((await mountHeader(true)).exists()).toBe(false)
  })
})
