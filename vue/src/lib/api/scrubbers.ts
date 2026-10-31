import { useApi } from '@/composables/useApi'
import type { CanisterCreate, CostLineInput, ScrubberCanister, ScrubberUseInput } from './types'

/** API.md §7 (scrubber). Every write answers with the whole canister. */
export function useScrubbersApi() {
  const { getWithToken, postWithToken, deleteWithToken } = useApi()
  const scrubbers = (teamId: number) => `/v1/teams/${teamId}/scrubbers`
  const canister = (teamId: number, canisterId: number) => `${scrubbers(teamId)}/${canisterId}`
  return {
    list: async (teamId: number) =>
      (await getWithToken<ScrubberCanister[]>(scrubbers(teamId))).data,
    get: async (teamId: number, canisterId: number) =>
      (await getWithToken<ScrubberCanister>(canister(teamId, canisterId))).data,
    create: async (teamId: number, request: CanisterCreate) =>
      (await postWithToken<ScrubberCanister>(scrubbers(teamId), request)).data,
    addUse: async (teamId: number, canisterId: number, request: ScrubberUseInput) =>
      (await postWithToken<ScrubberCanister>(`${canister(teamId, canisterId)}/uses`, request)).data,
    deleteUse: async (teamId: number, canisterId: number, useId: number) =>
      (await deleteWithToken<ScrubberCanister>(`${canister(teamId, canisterId)}/uses/${useId}`))
        .data,
    markEmpty: async (teamId: number, canisterId: number) =>
      (await postWithToken<ScrubberCanister>(`${canister(teamId, canisterId)}/empty`, {})).data,
    reopen: async (teamId: number, canisterId: number) =>
      (await postWithToken<ScrubberCanister>(`${canister(teamId, canisterId)}/reopen`, {})).data,
    addCostLine: async (teamId: number, canisterId: number, request: CostLineInput) =>
      (await postWithToken<ScrubberCanister>(`${canister(teamId, canisterId)}/cost-lines`, request))
        .data,
    deleteCostLine: async (teamId: number, canisterId: number, costLineId: number) =>
      (
        await deleteWithToken<ScrubberCanister>(
          `${canister(teamId, canisterId)}/cost-lines/${costLineId}`,
        )
      ).data,
  }
}
