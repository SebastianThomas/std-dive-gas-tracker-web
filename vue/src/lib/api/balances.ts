import { useApi } from '@/composables/useApi'
import type { Balances, Payment, PaymentInput } from './types'

/** API.md §5 (balances and payments). Refetch the balances after a payment change. */
export function useBalancesApi() {
  const { getWithToken, postWithToken, deleteWithToken } = useApi()
  const team = (teamId: number) => `/v1/teams/${teamId}`
  return {
    balances: async (teamId: number) =>
      (await getWithToken<Balances>(`${team(teamId)}/balances`)).data,
    payments: async (teamId: number) =>
      (await getWithToken<Payment[]>(`${team(teamId)}/payments`)).data,
    recordPayment: async (teamId: number, input: PaymentInput) =>
      (await postWithToken<Payment>(`${team(teamId)}/payments`, input)).data,
    deletePayment: async (teamId: number, paymentId: number) => {
      await deleteWithToken(`${team(teamId)}/payments/${paymentId}`)
    },
  }
}
