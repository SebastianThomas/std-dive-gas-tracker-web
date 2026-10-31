import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'

const page = { template: '<div />' }
const tokenFor = (uid: number, name = 'x') =>
  `h.${btoa(JSON.stringify({ uid, name })).replace(/=+$/, '')}.s`

function setUp() {
  setActivePinia(createPinia())
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/t/1', name: 'Team', component: page, meta: { requiresAuth: true } },
      { path: '/login', name: 'Login', component: page },
    ],
  })
}

const mountApp = (router: ReturnType<typeof setUp>) =>
  mount(App, {
    global: { plugins: [router], stubs: { AppHeader: true, Toaster: true, RouterView: true } },
  })

describe('App: a session that ends', () => {
  afterEach(() => vi.restoreAllMocks())

  it('leads to the login while a page is open, and back afterwards', async () => {
    const router = setUp()
    const auth = useAuthStore()
    auth.login('token')
    await router.push('/t/1')
    mountApp(router)

    auth.accessToken = null
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Login')
    expect(router.currentRoute.value.query.from).toBe('/t/1')
  })

  it('leads to the login even when it ends during the first navigation', async () => {
    const router = setUp()
    const auth = useAuthStore()
    auth.login('token')
    mountApp(router)

    // the header's first request fails before the first page has opened
    const navigation = router.push('/t/1')
    auth.accessToken = null
    await navigation
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Login')
  })

  it('keeps the page and its data when the same person renews the session', async () => {
    const router = setUp()
    const auth = useAuthStore()
    const session = useSessionStore()
    auth.login(tokenFor(1))
    await router.push('/t/1')
    mountApp(router)
    session.me = { userId: 1, displayName: 'Dana', teams: [] }

    auth.login(tokenFor(1, 'renewed'))
    await flushPromises()

    expect(session.me).not.toBeNull()
  })

  it("forgets the previous person's data when someone else logs in", async () => {
    const router = setUp()
    const auth = useAuthStore()
    const session = useSessionStore()
    auth.login(tokenFor(1))
    await router.push('/t/1')
    mountApp(router)
    session.me = { userId: 1, displayName: 'Dana', teams: [] }

    auth.login(tokenFor(2))
    await flushPromises()

    expect(session.me).toBeNull()
  })

  it('stays put on a page that needs no login', async () => {
    const router = setUp()
    const auth = useAuthStore()
    auth.login('token')
    await router.push('/login')
    mountApp(router)

    auth.accessToken = null
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/login')
  })
})
