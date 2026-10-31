import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import JoinTeamView from '@/views/JoinTeamView.vue'

const joinByInvite = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api/teams', () => ({
  useTeamsApi: () => ({
    previewInvite: async () => ({ teamId: 1, teamName: 'Team', alreadyMember: false }),
    joinByInvite,
  }),
}))
vi.mock('@/lib/api/me', () => ({ useMeApi: () => ({ getMe: async () => ({ teams: [] }) }) }))

describe('a button whose operation is on its way', () => {
  it('stays disabled until it returns, so a second tap sends nothing', async () => {
    const page = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Start', component: page },
        { path: '/t/:teamId', name: 'TeamHome', component: page },
        { path: '/join/:token', name: 'JoinTeam', component: JoinTeamView },
      ],
    })
    await router.push('/join/abc')
    const wrapper = mount(JoinTeamView, { global: { plugins: [createPinia(), router] } })
    await flushPromises()
    let finish!: (value: { teamId: number }) => void
    joinByInvite.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const button = wrapper.get('button')

    await button.trigger('click')
    await button.trigger('click')

    expect(button.attributes('disabled')).toBeDefined()
    expect(joinByInvite).toHaveBeenCalledTimes(1)

    finish({ teamId: 1 })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('TeamHome')
  })
})
