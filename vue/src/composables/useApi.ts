import { resolveUrl } from '@/lib/globals/url/resolveUrl'
import { useAuthStore } from '@/stores/auth'
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

const UNREACHABLE = 'The server is not reachable. Please try again later.'

/** No response at all (network error / timeout) or a gateway-level error. */
function isUnreachable(err: unknown): boolean {
  if (axios.isCancel(err) || !axios.isAxiosError(err)) return false
  const status = err.response?.status
  return !err.response || status === 502 || status === 503 || status === 504
}

/**
 * The only way to call the gas backend: adds the bearer token, renews the session once on a 401 and
 * retries (a 401 means nothing happened, so this is safe for writes too). If it can't be renewed the
 * call waits for the login (the caller's button stays busy), then continues. Drops anything that
 * belongs to another person's session. Ported (minus offline mode) from the dive-logger frontend's
 * useApi. Callers catch, then `toast.error(extractErrorDetail(err))`.
 */
export function useApi() {
  const authStore = useAuthStore()

  const tokenOrRefresh = async (force: boolean): Promise<string> => {
    if (!force && authStore.accessToken) return authStore.accessToken
    const token = authStore.sessionExpired ? null : await authStore.refreshToken()
    if (token) return token
    if (authStore.status === 'unreachable') throw new Error(UNREACHABLE)
    const renewed = await authStore.waitForLogin()
    if (renewed) return renewed
    throw new Error('Your session has ended, please log in again.')
  }

  const request = async <T, D = unknown>(
    method: string,
    url: string,
    body?: D,
    init: AxiosRequestConfig = {},
  ): Promise<AxiosResponse<T>> => {
    const session = authStore.sessionVersion
    const send = async (token: string) => {
      // Not on behalf of someone else, should another person have logged in during the wait.
      if (authStore.sessionVersion !== session) {
        throw new axios.CanceledError('Not sent: you are now logged in as someone else.')
      }
      const response = await axios.request<T, AxiosResponse<T>, D>({
        ...init,
        method,
        url: resolveUrl(url),
        data: body,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
      })
      if (authStore.sessionVersion !== session) {
        throw new axios.CanceledError('Login session changed')
      }
      return response
    }
    try {
      return await send(await tokenOrRefresh(false))
    } catch (err) {
      // A plain Error, so the caller's extractErrorDetail() toast shows this exact message.
      if (isUnreachable(err)) throw new Error(UNREACHABLE)
      if (!axios.isAxiosError(err) || err.response?.status !== 401) throw err
      return await send(await tokenOrRefresh(true))
    }
  }

  return {
    getWithToken: <T>(url: string, init?: AxiosRequestConfig) =>
      request<T>('GET', url, undefined, init),
    postWithToken: <T, D = unknown>(url: string, body?: D, init?: AxiosRequestConfig) =>
      request<T, D>('POST', url, body, init),
    putWithToken: <T, D = unknown>(url: string, body?: D, init?: AxiosRequestConfig) =>
      request<T, D>('PUT', url, body, init),
    deleteWithToken: <T>(url: string, init?: AxiosRequestConfig) =>
      request<T>('DELETE', url, undefined, init),
  }
}
