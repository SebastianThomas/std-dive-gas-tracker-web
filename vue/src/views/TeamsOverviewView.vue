<template>
  <PageShell title="All teams">
    <template #actions>
      <AppButton variant="secondary" :to="{ name: 'TeamCreate' }">
        <i class="fa-solid fa-plus" aria-hidden="true" />New team
      </AppButton>
    </template>
    <LoadState :loading="loading" :error="error" :ready="rows !== null" @retry="reload">
      <AppCard>
        <ul class="-mx-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="row in rows" :key="row.team.teamId">
            <RouterLink
              :to="{ name: 'TeamHome', params: { teamId: row.team.teamId } }"
              class="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span class="min-w-0 break-words font-medium text-slate-900 dark:text-slate-100">
                {{ row.team.name }}
              </span>
              <span class="ml-auto text-right font-medium">
                <BalanceLine
                  v-if="row.balance"
                  :balance="row.balance"
                  :currency="row.currency"
                  you
                />
                <span v-else class="text-slate-500 dark:text-slate-400">Nothing yet</span>
              </span>
            </RouterLink>
          </li>
        </ul>
      </AppCard>
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import PageShell from '@/components/layout/PageShell.vue'
import BalanceLine from '@/components/money/BalanceLine.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useBalancesApi } from '@/lib/api/balances'
import { useSessionStore } from '@/stores/session'

// Every team at a glance: my balance in each. Never added up: teams can use different currencies.
const session = useSessionStore()
const {
  data: rows,
  loading,
  error,
  reload,
} = useLoad(async () => {
  const me = await session.load()
  return Promise.all(
    me.teams.map(async (team) => {
      const balances = await useBalancesApi().balances(team.teamId)
      const mine = balances.members.find((row) => row.member.memberId === team.memberId)
      return { team, balance: mine?.balance, currency: balances.currency }
    }),
  )
})

void reload()
</script>
