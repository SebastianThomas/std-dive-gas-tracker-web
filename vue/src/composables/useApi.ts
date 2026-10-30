import { resolveUrl } from '@/lib/globals/url/resolveUrl'
import { useAuthStore } from '@/stores/auth'
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

/** No response at all (network error / timeout) or a gateway-level error. */
function isUnreachable(err: unknown): boolean {
  if (axios.isCancel(err) || !axios.isAxiosError(err)) return false
  const status = err.response?.status
  return !err.response || status === 502 || status === 503 || status === 504
}

/**
 * The only way to call the gas backend: adds the bearer token, refreshes once on a 401 and retries,
 * and drops answers that belong to a previous login session. Ported (minus offline mode) from the
 * dive-logger frontend's useApi. Callers catch, then `toast.error(extractErrorDetail(err))`.
 */
export function useApi() {
  const authStore = useAuthStore()

  const tokenOrRefresh = async (force: boolean): Promise<string> => {
    if (!force && authStore.accessToken) return authStore.accessToken
    const token = await authStore.refreshToken()
    if (token) return token
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
      if (isUnreachable(err))
        throw new Error('The server is not reachable. Please try again later.')
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
