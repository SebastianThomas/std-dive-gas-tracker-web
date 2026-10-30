import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from '@/views/LoginView.vue'

async function mountLogin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Home', component: { template: '<div />' } },
      { path: '/login', name: 'Login', component: LoginView },
    ],
  })
  await router.push('/login')
  return mount(LoginView, { global: { plugins: [createPinia(), router] } })
}

describe('LoginView', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('hides the dev login unless VITE_DEV_LOGIN is "true"', async () => {
    vi.stubEnv('VITE_DEV_LOGIN', 'false')
    expect((await mountLogin()).find('[data-testid="dev-login"]').exists()).toBe(false)
  })

  it('shows the dev login in local development', async () => {
    vi.stubEnv('VITE_DEV_LOGIN', 'true')
    expect((await mountLogin()).find('[data-testid="dev-login"]').exists()).toBe(true)
  })
})
