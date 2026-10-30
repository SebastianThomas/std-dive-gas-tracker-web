import { useApi } from '@/composables/useApi'
import type {
  CostLineInput,
  ReadingInput,
  VesselCreate,
  VesselDetail,
  VesselStatusFilter,
  VesselSummary,
  VesselUpdate,
} from './types'

/** API.md §3 (banks). Sub-resource writes answer with the whole bank. */
export function useVesselsApi() {
  const { getWithToken, postWithToken, putWithToken, deleteWithToken } = useApi()
  const vessels = (teamId: number) => `/v1/teams/${teamId}/vessels`
  const vessel = (teamId: number, vesselId: number) => `${vessels(teamId)}/${vesselId}`
  return {
    list: async (teamId: number, status: VesselStatusFilter = 'IN_SERVICE') =>
      (await getWithToken<VesselSummary[]>(`${vessels(teamId)}?status=${status}`)).data,
    get: async (teamId: number, vesselId: number) =>
      (await getWithToken<VesselDetail>(vessel(teamId, vesselId))).data,
    create: async (teamId: number, request: VesselCreate) =>
      (await postWithToken<VesselDetail>(vessels(teamId), request)).data,
    update: async (teamId: number, vesselId: number, request: VesselUpdate) =>
      (await putWithToken<VesselDetail>(vessel(teamId, vesselId), request)).data,
    close: async (teamId: number, vesselId: number, closingPressureBar: number) =>
      (
        await postWithToken<VesselDetail>(`${vessel(teamId, vesselId)}/close`, {
          closingPressureBar,
        })
      ).data,
    reopen: async (teamId: number, vesselId: number) =>
      (await postWithToken<VesselDetail>(`${vessel(teamId, vesselId)}/reopen`)).data,
    addCostLine: async (teamId: number, vesselId: number, request: CostLineInput) =>
      (await postWithToken<VesselDetail>(`${vessel(teamId, vesselId)}/cost-lines`, request)).data,
    deleteCostLine: async (teamId: number, vesselId: number, costLineId: number) =>
      (await deleteWithToken<VesselDetail>(`${vessel(teamId, vesselId)}/cost-lines/${costLineId}`))
        .data,
    addReading: async (teamId: number, vesselId: number, request: ReadingInput) =>
      (await postWithToken<VesselDetail>(`${vessel(teamId, vesselId)}/readings`, request)).data,
  }
}
