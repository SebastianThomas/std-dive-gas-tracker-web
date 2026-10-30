<template>
  <PageShell title="Reports" :back="{ name: 'TeamSettings', params: { teamId } }">
    <AppCard title="Gas used">
      <div class="mb-3 flex flex-wrap gap-2" role="group" aria-label="Period">
        <button
          v-for="option in periods"
          :key="option.key"
          type="button"
          class="min-h-11 rounded-full border px-3 text-base font-medium"
          :class="
            period === option.key
              ? 'border-sky-600 bg-sky-600 text-white'
              : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
          "
          :aria-pressed="period === option.key"
          @click="period = option.key"
        >
          {{ option.label }}
        </button>
      </div>
      <LoadState
        :loading="consumption.loading.value"
        :error="consumption.error.value"
        :ready="consumption.data.value !== null"
        @retry="consumption.reload"
      >
        <p
          v-if="consumption.data.value?.rows.length === 0"
          class="text-slate-500 dark:text-slate-400"
        >
          No fills in this period.
        </p>
        <ul v-else class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          <li
            v-for="row in consumption.data.value?.rows ?? []"
            :key="row.member.memberId"
            class="py-2"
          >
            <span class="flex justify-between gap-2">
              <span class="min-w-0 text-slate-900 dark:text-slate-100">{{
                row.member.displayName
              }}</span>
              <span class="shrink-0 font-medium text-slate-900 dark:text-slate-100">
                {{ formatMoney(row.charge, team.currency) }}
              </span>
            </span>
            <span class="text-sm text-slate-500 dark:text-slate-400">
              {{ row.fills }} {{ row.fills === 1 ? 'fill' : 'fills' }} · O2
              {{ formatLitres(row.o2Litres) }} · He {{ formatLitres(row.heLitres) }}
            </span>
          </li>
        </ul>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Bought gas only (air is free), at today's prices.
        </p>
      </LoadState>
    </AppCard>

    <AppCard title="Losses of closed banks">
      <LoadState
        :loading="losses.loading.value"
        :error="losses.error.value"
        :ready="losses.data.value !== null"
        @retry="losses.reload"
      >
        <p
          v-if="losses.data.value?.vessels.length === 0"
          class="text-slate-500 dark:text-slate-400"
        >
          No bank has been closed yet.
        </p>
        <ul v-else class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="entry in losses.data.value?.vessels ?? []" :key="entry.vessel.vesselId">
            <RouterLink
              :to="{ name: 'BankDetail', params: { teamId, vesselId: entry.vessel.vesselId } }"
              class="flex min-h-11 flex-col py-2"
            >
              <span class="flex justify-between gap-2">
                <span class="min-w-0 text-slate-900 dark:text-slate-100">{{
                  entry.vessel.label
                }}</span>
                <span class="shrink-0 font-medium text-slate-900 dark:text-slate-100">
                  {{ formatPercent(entry.report.lossFraction) }} lost
                </span>
              </span>
              <span class="text-sm text-slate-500 dark:text-slate-400">
                <template v-if="entry.vessel.closedAt"
                  >Closed {{ formatDate(entry.vessel.closedAt) }} ·
                </template>
                {{ formatLitres(entry.report.residualLitres) }} left,
                {{ formatLitres(entry.report.lineLossLitres) }} in the lines
              </span>
            </RouterLink>
          </li>
        </ul>
      </LoadState>
    </AppCard>

    <AppCard title="Exact per bank vs shared loss pool">
      <p class="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Everyone's balance if all banks shared losses one way or the other (to help choose).
      </p>
      <LoadState
        :loading="comparison.loading.value"
        :error="comparison.error.value"
        :ready="comparison.data.value !== null"
        @retry="comparison.reload"
      >
        <ul class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          <li
            v-for="row in comparison.data.value?.members ?? []"
            :key="row.member.memberId"
            class="py-2"
          >
            <span class="text-slate-900 dark:text-slate-100">{{ row.member.displayName }}</span>
            <dl
              class="grid grid-cols-[1fr_auto] gap-x-4 text-sm text-slate-600 dark:text-slate-400"
            >
              <dt>Exact per bank</dt>
              <dd class="text-right">{{ formatMoney(row.trueUp, team.currency) }}</dd>
              <dt>Shared loss pool</dt>
              <dd class="text-right">{{ formatMoney(row.pooled, team.currency) }}</dd>
              <dt>Difference</dt>
              <dd class="text-right font-medium text-slate-800 dark:text-slate-200">
                {{ formatMoney(row.delta, team.currency) }}
              </dd>
            </dl>
          </li>
        </ul>
      </LoadState>
    </AppCard>
  </PageShell>
</template>

<script setup lang="ts">
import PageShell from '@/components/layout/PageShell.vue'
import AppCard from '@/components/ui/AppCard.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useReportsApi } from '@/lib/api/reports'
import { formatDate } from '@/lib/format/dates'
import { formatMoney } from '@/lib/format/money'
import { formatLitres, formatPercent } from '@/lib/format/units'
import { useTeamStore } from '@/stores/team'
import { ref, watch } from 'vue'

// F7: gas used per member in a period, losses of closed banks, the two loss policies side by side.
type Period = 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'ALL'

const team = useTeamStore()
const { teamId } = useTeamRoute()
const period = ref<Period>('MONTH')
const periods: { key: Period; label: string }[] = [
  { key: 'MONTH', label: 'This month' },
  { key: 'LAST_MONTH', label: 'Last month' },
  { key: 'YEAR', label: 'This year' },
  { key: 'ALL', label: 'All time' },
]

/** Local calendar boundaries as epoch millis ([from, to)); undefined: all time. */
function range(key: Period): [number, number] | undefined {
  const now = new Date()
  switch (key) {
    case 'MONTH':
      return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), now.getTime() + 1]
    case 'LAST_MONTH':
      return [
        new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
        new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      ]
    case 'YEAR':
      return [new Date(now.getFullYear(), 0, 1).getTime(), now.getTime() + 1]
    case 'ALL':
      return undefined
    default: {
      const unknown: never = key
      return unknown
    }
  }
}

const api = useReportsApi()
const consumption = useLoad(() => {
  const bounds = range(period.value)
  return api.consumption(teamId.value, bounds?.[0], bounds?.[1])
})
const losses = useLoad(() => api.losses(teamId.value))
const comparison = useLoad(() => api.policyComparison(teamId.value))

watch(period, () => void consumption.reload())
void Promise.all([consumption.reload(), losses.reload(), comparison.reload()])
</script>
