import { useApi } from '@/composables/useApi'
import type { ConsumptionReport, LossesReport, PolicyComparison } from './types'

/** API.md §6 (reports). {@code from}/{@code to}: epoch millis, {@code to} exclusive. */
export function useReportsApi() {
  const { getWithToken } = useApi()
  const reports = (teamId: number) => `/v1/teams/${teamId}/reports`
  return {
    consumption: async (teamId: number, from?: number, to?: number) => {
      const query = from !== undefined && to !== undefined ? `?from=${from}&to=${to}` : ''
      return (await getWithToken<ConsumptionReport>(`${reports(teamId)}/consumption${query}`)).data
    },
    losses: async (teamId: number) =>
      (await getWithToken<LossesReport>(`${reports(teamId)}/losses`)).data,
    policyComparison: async (teamId: number) =>
      (await getWithToken<PolicyComparison>(`${reports(teamId)}/policy-comparison`)).data,
  }
}
