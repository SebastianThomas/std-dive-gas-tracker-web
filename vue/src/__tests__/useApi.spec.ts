import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import axios, { AxiosError, type AxiosResponse } from 'axios'
import { useApi } from '@/composables/useApi'
import { refreshAccessToken } from '@/lib/globals/auth/refreshToken'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/lib/globals/auth/refreshToken', () => ({
  refreshAccessToken: vi.fn(),
  logoutOnServer: vi.fn(async () => true),
  devLogin: vi.fn(),
}))

const refresh = vi.mocked(refreshAccessToken)
const send = vi.spyOn(axios, 'request')

const tokenFor = (uid: number, name = 'x') =>
  `h.${btoa(JSON.stringify({ uid, name })).replace(/=+$/, '')}.s`
const dana = tokenFor(1, 'first')
const danaRenewed = tokenFor(1, 'renewed')
const alice = tokenFor(2)

const unauthorized = () =>
  new AxiosError('401', '401', undefined, undefined, { status: 401 } as AxiosResponse)
const sentTokens = () =>
  send.mock.calls.map(
    ([config]) => (config.headers as Record<string, string>).Authorization?.split(' ')[1],
  )

describe('useApi: a session that ran out', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    refresh.mockReset()
    send.mockReset()
  })

  it('retries with the renewed token and hands over the answer', async () => {
    const auth = useAuthStore()
    auth.login(dana)
    const version = auth.sessionVersion
    send.mockRejectedValueOnce(unauthorized()).mockResolvedValueOnce({ data: 'saved' })
    refresh.mockResolvedValue({ kind: 'ok', token: danaRenewed })

    const response = await useApi().postWithToken('/v1/x', {})

    expect(response.data).toBe('saved')
    expect(sentTokens()).toEqual([dana, danaRenewed])
    // the page stays: App keys its view on this
    expect(auth.sessionVersion).toBe(version)
  })

  it('tries only once more', async () => {
    useAuthStore().login(dana)
    send.mockRejectedValue(unauthorized())
    refresh.mockResolvedValue({ kind: 'ok', token: danaRenewed })

    await expect(useApi().postWithToken('/v1/x', {})).rejects.toBeInstanceOf(AxiosError)

    expect(send).toHaveBeenCalledTimes(2)
  })

  it('waits for the login when the session cannot be renewed, then continues', async () => {
    const auth = useAuthStore()
    auth.login(dana)
    const version = auth.sessionVersion
    send.mockRejectedValueOnce(unauthorized()).mockResolvedValueOnce({ data: 'saved' })
    refresh.mockResolvedValue({ kind: 'unauthorized' })
    let settled = false

    const pending = useApi()
      .postWithToken('/v1/x', {})
      .finally(() => (settled = true))
    await flushPromises()

    expect(auth.sessionExpired).toBe(true)
    expect(settled).toBe(false)
    expect(send).toHaveBeenCalledTimes(1)

    auth.login(danaRenewed)

    await expect(pending).resolves.toMatchObject({ data: 'saved' })
    expect(sentTokens()).toEqual([dana, danaRenewed])
    expect(auth.sessionVersion).toBe(version)
  })

  it('holds new requests during the wait too, without asking the server again', async () => {
    const auth = useAuthStore()
    auth.login(dana)
    send.mockRejectedValueOnce(unauthorized()).mockResolvedValue({ data: 'ok' })
    refresh.mockResolvedValue({ kind: 'unauthorized' })

    const first = useApi().postWithToken('/v1/x', {})
    await flushPromises()
    const second = useApi().getWithToken('/v1/y')
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(1)

    auth.login(danaRenewed)

    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
  })

  it('never sends it on behalf of another person who logs in', async () => {
    const auth = useAuthStore()
    auth.login(dana)
    const version = auth.sessionVersion
    send.mockRejectedValueOnce(unauthorized())
    refresh.mockResolvedValue({ kind: 'unauthorized' })

    const pending = useApi().postWithToken('/v1/x', {})
    await flushPromises()
    auth.login(alice)

    await expect(pending).rejects.toSatisfy(axios.isCancel)
    expect(send).toHaveBeenCalledTimes(1)
    expect(auth.sessionVersion).toBe(version + 1)
  })

  it('gives up when they log out instead', async () => {
    const auth = useAuthStore()
    auth.login(dana)
    send.mockRejectedValueOnce(unauthorized())
    refresh.mockResolvedValue({ kind: 'unauthorized' })

    const pending = useApi().postWithToken('/v1/x', {})
    await flushPromises()
    await auth.logout()

    await expect(pending).rejects.toThrow('session has ended')
    expect(send).toHaveBeenCalledTimes(1)
    expect(auth.sessionExpired).toBe(false)
  })

  it('says so when the token server is unreachable, instead of asking for a login', async () => {
    const auth = useAuthStore()
    auth.login(dana)
    send.mockRejectedValueOnce(unauthorized())
    refresh.mockResolvedValue({ kind: 'unreachable' })

    await expect(useApi().postWithToken('/v1/x', {})).rejects.toThrow('not reachable')
    expect(auth.sessionExpired).toBe(false)
  })
})
