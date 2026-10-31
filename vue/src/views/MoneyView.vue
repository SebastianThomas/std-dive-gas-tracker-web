<template>
  <PageShell title="Money">
    <LoadState :loading="loading" :error="error" :ready="data !== null" @retry="reload">
      <template v-if="data">
        <AppCard>
          <p class="text-2xl font-semibold">
            <BalanceLine
              v-if="mine"
              :balance="mine.balance"
              :currency="data.balances.currency"
              you
            />
            <span v-else class="text-slate-500 dark:text-slate-400">Nothing yet</span>
          </p>
          <p
            v-if="mine && Number(mine.provisionalCharges) > 0"
            class="mt-1 text-sm text-amber-700 dark:text-amber-400"
          >
            Includes {{ money(mine.provisionalCharges) }} estimated:
            {{ stillInUseWords(team.gasEnabled, team.scrubberEnabled) }} still in use are re-priced
            when they are finished.
          </p>
          <details v-if="mine" class="mt-2">
            <summary
              class="flex min-h-11 cursor-pointer items-center text-sky-700 dark:text-sky-400"
            >
              How it adds up
            </summary>
            <dl
              class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300"
            >
              <template v-if="showGas">
                <dt>You paid for banks</dt>
                <dd class="text-right">{{ money(mine.paidCosts) }}</dd>
                <dt>Your fills</dt>
                <dd class="text-right">−{{ money(mine.fillCharges) }}</dd>
                <dt>Your share of losses</dt>
                <dd class="text-right">−{{ money(mine.lossShares) }}</dd>
              </template>
              <template v-if="hasScrubber">
                <dt>You paid for scrubber</dt>
                <dd class="text-right">{{ money(mine.scrubberPaid) }}</dd>
                <dt>Scrubber you used</dt>
                <dd class="text-right">−{{ money(mine.scrubberCharges) }}</dd>
              </template>
              <dt>Payments you made</dt>
              <dd class="text-right">{{ money(mine.paymentsSent) }}</dd>
              <dt>Payments you received</dt>
              <dd class="text-right">−{{ money(mine.paymentsReceived) }}</dd>
            </dl>
          </details>
        </AppCard>

        <AppCard title="Settle up">
          <p
            v-if="data.balances.suggestions.length === 0"
            class="text-slate-500 dark:text-slate-400"
          >
            Everyone is settled.
          </p>
          <ul v-else class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            <li
              v-for="suggestion in data.balances.suggestions"
              :key="`${suggestion.from.memberId}-${suggestion.to.memberId}`"
              class="flex items-center justify-between gap-2 py-2"
            >
              <span class="min-w-0 text-slate-800 dark:text-slate-200">
                {{ suggestion.from.displayName }} → {{ suggestion.to.displayName }}
                <span class="font-medium">{{ money(suggestion.amount) }}</span>
              </span>
              <AppButton
                v-if="canRecord(suggestion.from.memberId, suggestion.to.memberId)"
                variant="secondary"
                @click="useSuggestion(suggestion)"
              >
                Paid
              </AppButton>
            </li>
          </ul>
        </AppCard>

        <AppCard id="record-payment" title="Record a payment">
          <PaymentForm
            ref="paymentForm"
            :members="team.members"
            :currency="data.balances.currency"
            :my-member-id="team.myMemberId ?? 0"
            :saving="saving"
            @submit="record"
          />
        </AppCard>

        <AppCard title="Balances">
          <ul class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            <li
              v-for="row in data.balances.members"
              :key="row.member.memberId"
              class="flex flex-wrap items-baseline justify-between gap-x-2 py-2"
            >
              <span class="text-slate-900 dark:text-slate-100">{{ row.member.displayName }}</span>
              <span class="text-right">
                <BalanceLine :balance="row.balance" :currency="data.balances.currency" />
                <span
                  v-if="Number(row.provisionalCharges) > 0"
                  class="ml-1 text-sm text-amber-700 dark:text-amber-400"
                  >(estimate)</span
                >
              </span>
            </li>
          </ul>
          <p v-if="stock" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ stock }} {{ money(data.balances.inventoryValue) }}.
          </p>
        </AppCard>

        <AppCard title="Payments">
          <p v-if="data.payments.length === 0" class="text-slate-500 dark:text-slate-400">
            No payments yet.
          </p>
          <ul v-else class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            <li
              v-for="payment in data.payments"
              :key="payment.paymentId"
              class="flex flex-col gap-2 py-2"
            >
              <span class="flex items-baseline justify-between gap-2">
                <span class="min-w-0 text-slate-800 dark:text-slate-200">
                  {{ payment.from.displayName }} → {{ payment.to.displayName }}
                </span>
                <span class="shrink-0 font-medium text-slate-900 dark:text-slate-100">
                  {{ money(payment.amount) }}
                </span>
              </span>
              <span class="text-sm text-slate-500 dark:text-slate-400">
                {{ formatDate(payment.paidAt)
                }}<template v-if="payment.note"> · {{ payment.note }}</template>
              </span>
              <ConfirmAction
                v-if="canRecord(payment.from.memberId, payment.to.memberId)"
                v-model:open="confirmDelete[payment.paymentId]"
                label="Delete"
                variant="ghost"
                :message="`Delete the payment of ${money(payment.amount)} from ${payment.from.displayName} to ${payment.to.displayName}?`"
                confirm-label="Delete payment"
                :busy="deletingId === payment.paymentId"
                class="self-start"
                @confirm="remove(payment.paymentId)"
              />
            </li>
          </ul>
        </AppCard>
      </template>
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import PageShell from '@/components/layout/PageShell.vue'
import BalanceLine from '@/components/money/BalanceLine.vue'
import PaymentForm from '@/components/money/PaymentForm.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import ConfirmAction from '@/components/ui/ConfirmAction.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useBalancesApi } from '@/lib/api/balances'
import type { PaymentInput, Suggestion } from '@/lib/api/types'
import { formatDate } from '@/lib/format/dates'
import { formatMoney } from '@/lib/format/money'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { stillInUseWords, stockSentence } from '@/lib/utils/teams'
import { useTeamStore } from '@/stores/team'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { toast } from 'vue-sonner'

// F6: my balance and how it adds up, who should pay whom (one tap fills the payment form),
// everyone's balance, payments. All sums come from the backend; this only formats them.
const team = useTeamStore()
const { teamId } = useTeamRoute()
const { data, loading, error, reload } = useLoad(async () => {
  const api = useBalancesApi()
  const [balances, payments] = await Promise.all([
    api.balances(teamId.value),
    api.payments(teamId.value),
  ])
  return { balances, payments }
})
const paymentForm = useTemplateRef<InstanceType<typeof PaymentForm>>('paymentForm')
const saving = ref(false)
const deletingId = ref<number | null>(null)
const confirmDelete = ref<Record<number, boolean>>({})

const money = (amount: string) =>
  formatMoney(amount, data.value?.balances.currency ?? team.currency)
const mine = computed(() =>
  data.value?.balances.members.find((row) => row.member.memberId === team.myMemberId),
)
const stock = computed(() => stockSentence(team.gasEnabled, team.scrubberEnabled))
const showGas = computed(
  () =>
    team.gasEnabled ||
    (mine.value !== undefined &&
      [mine.value.paidCosts, mine.value.fillCharges, mine.value.lossShares].some(
        (amount) => Number(amount) !== 0,
      )),
)
const hasScrubber = computed(
  () =>
    mine.value !== undefined &&
    (Number(mine.value.scrubberPaid) !== 0 || Number(mine.value.scrubberCharges) !== 0),
)
/** Payer, recipient or an admin may record or delete a payment (DOMAIN §10). */
const canRecord = (fromId: number, toId: number) =>
  team.isAdmin || fromId === team.myMemberId || toId === team.myMemberId

async function useSuggestion(suggestion: Suggestion) {
  paymentForm.value?.prefill(suggestion.from.memberId, suggestion.to.memberId, suggestion.amount)
  await nextTick()
  document.getElementById('record-payment')?.scrollIntoView({ behavior: 'smooth' })
}

async function record(input: PaymentInput) {
  saving.value = true
  try {
    await useBalancesApi().recordPayment(teamId.value, input)
    paymentForm.value?.reset()
    toast.success('Payment recorded.')
    await reload()
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}

async function remove(paymentId: number) {
  deletingId.value = paymentId
  try {
    await useBalancesApi().deletePayment(teamId.value, paymentId)
    toast.success('Payment deleted.')
    await reload()
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    deletingId.value = null
  }
}

void reload()
</script>
