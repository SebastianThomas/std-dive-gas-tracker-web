import { useApi } from '@/composables/useApi'
import type { Me } from './types'

/** API.md §1 (me). Pattern for every API module: thin typed wrappers, no state, no toasts. */
export function useMeApi() {
  const { getWithToken, putWithToken } = useApi()
  return {
    getMe: async () => (await getWithToken<Me>('/v1/me')).data,
    updateMe: async (displayName: string) =>
      (await putWithToken<Me>('/v1/me', { displayName })).data,
  }
}
