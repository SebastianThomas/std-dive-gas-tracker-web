<template>
  <PageShell :title="team.team?.name ?? 'Home'">
    <AppButton :to="{ name: 'FillRecord', params: { teamId } }" class="w-full py-3 text-lg">
      <i class="fa-solid fa-circle-plus" aria-hidden="true" />Record a fill
    </AppButton>

    <LoadState :loading="loading" :error="error" :ready="data !== null" @retry="reload">
      <template v-if="data">
        <AppCard title="My balance">
          <template #actions>
            <AppButton variant="link" :to="{ name: 'Money', params: { teamId } }">Money</AppButton>
          </template>
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
            Partly an estimate: banks still in use are re-priced when they are closed.
          </p>
        </AppCard>

        <AppCard title="Low banks">
          <template #actions>
            <AppButton variant="link" :to="{ name: 'BankList', params: { teamId } }"
              >Banks</AppButton
            >
          </template>
          <p v-if="lowBanks.length === 0" class="text-slate-500 dark:text-slate-400">
            No bank is below {{ LOW_BANK_BAR }} bar.
          </p>
          <ul v-else class="-mx-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            <li v-for="bank in lowBanks" :key="bank.vesselId">
              <BankListItem :bank="bank" :team-id="teamId" :currency="team.currency" />
            </li>
          </ul>
        </AppCard>

        <AppCard title="My last fills">
          <template #actions>
            <AppButton variant="link" :to="{ name: 'FillList', params: { teamId } }"
              >All fills</AppButton
            >
          </template>
          <p v-if="data.fills.length === 0" class="text-slate-500 dark:text-slate-400">
            No fills yet.
          </p>
          <ul v-else class="-mx-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            <li v-for="fill in data.fills" :key="fill.fillId">
              <FillListItem :fill="fill" :team-id="teamId" :currency="team.currency" />
            </li>
          </ul>
        </AppCard>
      </template>
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import BankListItem from '@/components/bank/BankListItem.vue'
import FillListItem from '@/components/fill/FillListItem.vue'
import PageShell from '@/components/layout/PageShell.vue'
import BalanceLine from '@/components/money/BalanceLine.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useBalancesApi } from '@/lib/api/balances'
import { useFillsApi } from '@/lib/api/fills'
import { useVesselsApi } from '@/lib/api/vessels'
import { LOW_BANK_BAR, isLow } from '@/lib/utils/banks'
import { useTeamStore } from '@/stores/team'
import { computed } from 'vue'

// F8: the one primary action, then what you want to know on arrival in the gas room.
const RECENT_FILLS = 5

const team = useTeamStore()
const { teamId } = useTeamRoute()
const { data, loading, error, reload } = useLoad(async () => {
  const [balances, banks, fills] = await Promise.all([
    useBalancesApi().balances(teamId.value),
    useVesselsApi().list(teamId.value, 'IN_SERVICE'),
    useFillsApi().list(teamId.value, {
      memberId: team.myMemberId ?? undefined,
      size: RECENT_FILLS,
    }),
  ])
  return { balances, banks, fills: fills.result }
})
const mine = computed(() =>
  data.value?.balances.members.find((row) => row.member.memberId === team.myMemberId),
)
const lowBanks = computed(() =>
  (data.value?.banks ?? [])
    .filter(isLow)
    .toSorted((a, b) => a.estimatedPressureBar - b.estimatedPressureBar),
)

void reload()
</script>
