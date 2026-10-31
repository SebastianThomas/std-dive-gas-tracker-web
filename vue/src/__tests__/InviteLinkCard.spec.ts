import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import InviteLinkCard from '@/components/team/InviteLinkCard.vue'

const api = vi.hoisted(() => ({
  inviteLink: vi.fn(),
  resetInviteLink: vi.fn(),
  turnOffInviteLink: vi.fn(),
  turnOnInviteLink: vi.fn(),
}))
vi.mock('@/lib/api/teams', () => ({ useTeamsApi: () => api }))

const on = { token: 'current', canTurnBackOn: false }
const off = { canTurnBackOn: true }
const never = { canTurnBackOn: false }

async function mountCard(link: object) {
  api.inviteLink.mockResolvedValue(link)
  const wrapper = mount(InviteLinkCard, { props: { teamId: 1, teamName: 'Team' } })
  await flushPromises()
  return wrapper
}

const button = (wrapper: Awaited<ReturnType<typeof mountCard>>, label: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === label)

async function tap(wrapper: Awaited<ReturnType<typeof mountCard>>, label: string) {
  await button(wrapper, label)?.trigger('click')
  await flushPromises()
}

describe('InviteLinkCard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks before replacing the working link', async () => {
    const wrapper = await mountCard(on)
    api.resetInviteLink.mockResolvedValue({ token: 'fresh', canTurnBackOn: false })

    await tap(wrapper, 'New link')
    expect(api.resetInviteLink).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('stops working')

    await tap(wrapper, 'Create new link')
    expect(api.resetInviteLink).toHaveBeenCalledTimes(1)
    expect(wrapper.get('input').element.value).toContain('fresh')
  })

  it('can back out of replacing it', async () => {
    const wrapper = await mountCard(on)

    await tap(wrapper, 'New link')
    await tap(wrapper, 'Cancel')

    expect(api.resetInviteLink).not.toHaveBeenCalled()
    expect(wrapper.get('input').element.value).toContain('current')
  })

  it('asks before turning it off, then warns about bringing the same link back', async () => {
    const wrapper = await mountCard(on)
    api.turnOffInviteLink.mockResolvedValue(off)

    await tap(wrapper, 'Turn off')
    expect(api.turnOffInviteLink).not.toHaveBeenCalled()

    await tap(wrapper, 'Turn off link')
    expect(api.turnOffInviteLink).toHaveBeenCalledTimes(1)
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('create a new link instead')
  })

  it('turns the last link on again', async () => {
    const wrapper = await mountCard(off)
    api.turnOnInviteLink.mockResolvedValue(on)

    await tap(wrapper, 'Turn on last link')

    expect(api.turnOnInviteLink).toHaveBeenCalledTimes(1)
    expect(wrapper.get('input').element.value).toContain('current')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('offers a new link instead while it is off, without asking again', async () => {
    const wrapper = await mountCard(off)
    api.resetInviteLink.mockResolvedValue({ token: 'fresh', canTurnBackOn: false })

    await tap(wrapper, 'Create new link')

    expect(api.resetInviteLink).toHaveBeenCalledTimes(1)
    expect(api.turnOnInviteLink).not.toHaveBeenCalled()
  })

  it('has no warning and nothing to turn on before the first link', async () => {
    const wrapper = await mountCard(never)

    expect(button(wrapper, 'Create invite link')).toBeDefined()
    expect(button(wrapper, 'Turn on last link')).toBeUndefined()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
