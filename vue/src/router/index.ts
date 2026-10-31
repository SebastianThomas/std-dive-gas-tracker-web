import { createRouter, createWebHistory } from 'vue-router'
import type { TrackedArea } from '@/lib/utils/teams'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    title?: string
    /** Exists only for a team tracking this. */
    area?: TrackedArea
  }
}

// Routes as listed in AGENTS.md "Routes"; team pages live under /t/:teamId (the URL holds the team).
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Start',
      component: () => import('@/views/StartView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/teams',
      name: 'TeamsOverview',
      component: () => import('@/views/TeamsOverviewView.vue'),
      meta: { requiresAuth: true, title: 'All teams' },
    },
    {
      path: '/teams/new',
      name: 'TeamCreate',
      component: () => import('@/views/TeamCreateView.vue'),
      meta: { requiresAuth: true, title: 'New team' },
    },
    {
      path: '/t/:teamId(\\d+)',
      component: () => import('@/components/layout/TeamLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'TeamHome',
          component: () => import('@/views/TeamHomeView.vue'),
          meta: { title: 'Home' },
        },
        {
          path: 'fill',
          name: 'FillRecord',
          component: () => import('@/views/FillRecordView.vue'),
          meta: { area: 'gas', title: 'Record a fill' },
        },
        {
          path: 'fills',
          name: 'FillList',
          component: () => import('@/views/FillListView.vue'),
          meta: { area: 'gas', title: 'Fills' },
        },
        {
          path: 'fills/:fillId(\\d+)',
          name: 'FillDetail',
          component: () => import('@/views/FillDetailView.vue'),
          meta: { area: 'gas', title: 'Fill' },
        },
        // Mixes are banks holding blended gas: the bank views, in the Blend tab and its words.
        {
          path: 'blend',
          name: 'MixList',
          component: () => import('@/views/BankListView.vue'),
          props: { mixes: true },
          meta: { area: 'gas', title: 'Blend' },
        },
        {
          path: 'blend/new',
          name: 'MixCreate',
          component: () => import('@/views/BankCreateView.vue'),
          props: { mixes: true },
          meta: { area: 'gas', title: 'Add a mix' },
        },
        {
          path: 'blend/:vesselId(\\d+)',
          name: 'MixDetail',
          component: () => import('@/views/BankDetailView.vue'),
          props: { mixes: true },
          meta: { area: 'gas', title: 'Mix' },
        },
        {
          path: 'banks',
          name: 'BankList',
          component: () => import('@/views/BankListView.vue'),
          meta: { area: 'gas', title: 'Banks' },
        },
        {
          path: 'banks/new',
          name: 'BankCreate',
          component: () => import('@/views/BankCreateView.vue'),
          meta: { area: 'gas', title: 'Add a bank' },
        },
        {
          path: 'banks/:vesselId(\\d+)',
          name: 'BankDetail',
          component: () => import('@/views/BankDetailView.vue'),
          meta: { area: 'gas', title: 'Bank' },
        },
        {
          path: 'scrubber',
          name: 'ScrubberList',
          component: () => import('@/views/ScrubberListView.vue'),
          meta: { area: 'scrubber', title: 'Scrubber' },
        },
        {
          path: 'scrubber/new',
          name: 'ScrubberCreate',
          component: () => import('@/views/ScrubberCreateView.vue'),
          meta: { area: 'scrubber', title: 'Add a canister' },
        },
        {
          path: 'scrubber/:canisterId(\\d+)',
          name: 'ScrubberDetail',
          component: () => import('@/views/ScrubberDetailView.vue'),
          meta: { area: 'scrubber', title: 'Canister' },
        },
        {
          path: 'money',
          name: 'Money',
          component: () => import('@/views/MoneyView.vue'),
          meta: { title: 'Money' },
        },
        {
          path: 'team',
          name: 'TeamSettings',
          component: () => import('@/views/TeamView.vue'),
          meta: { title: 'Team' },
        },
        {
          path: 'team/reports',
          name: 'Reports',
          component: () => import('@/views/ReportsView.vue'),
          meta: { area: 'gas', title: 'Reports' },
        },
      ],
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: 'Log in' },
    },
    // Catch-all - must stay last, without requiresAuth (a typo shouldn't bounce to login).
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: 'Not found' },
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.matched.some((r) => r.meta.requiresAuth)) return
  const auth = useAuthStore()
  await auth.waitForInitialCheck()
  if (auth.isLoggedIn) return
  return { name: 'Login', query: { from: to.fullPath } }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Gas Tracker` : 'Gas Tracker'
})

export default router
