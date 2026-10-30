import { useApi } from '@/composables/useApi'
import type { Fill, FillInput, FillPage, FillPreview } from './types'

export interface FillFilter {
  memberId?: number
  vesselId?: number
  includeVoided?: boolean
  page?: number
  size?: number
}

/** API.md §4 (fills). Preview computes everything and saves nothing. */
export function useFillsApi() {
  const { getWithToken, postWithToken, putWithToken } = useApi()
  const fills = (teamId: number) => `/v1/teams/${teamId}/fills`
  return {
    list: async (teamId: number, filter: FillFilter = {}) => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined) params.set(key, String(value))
      }
      const query = params.size > 0 ? `?${params}` : ''
      return (await getWithToken<FillPage>(`${fills(teamId)}${query}`)).data
    },
    get: async (teamId: number, fillId: number) =>
      (await getWithToken<Fill>(`${fills(teamId)}/${fillId}`)).data,
    /** {@code replacing}: the fill being edited (priced as replaced, not as an extra fill). */
    preview: async (teamId: number, input: FillInput, signal?: AbortSignal, replacing?: number) => {
      const query = replacing === undefined ? '' : `?replacing=${replacing}`
      return (
        await postWithToken<FillPreview>(`${fills(teamId)}/preview${query}`, input, { signal })
      ).data
    },
    create: async (teamId: number, input: FillInput) =>
      (await postWithToken<Fill>(fills(teamId), input)).data,
    update: async (teamId: number, fillId: number, input: FillInput) =>
      (await putWithToken<Fill>(`${fills(teamId)}/${fillId}`, input)).data,
    void: async (teamId: number, fillId: number, reason: string) =>
      (await postWithToken<Fill>(`${fills(teamId)}/${fillId}/void`, { reason })).data,
  }
}
