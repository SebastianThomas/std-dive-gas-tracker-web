<template>
  <PageShell :title="mixes ? 'Blend' : 'Banks'">
    <template #actions>
      <AppButton :to="{ name: mixes ? 'MixCreate' : 'BankCreate', params: { teamId } }">
        <i class="fa-solid fa-plus" aria-hidden="true" />{{ mixes ? 'Add mix' : 'Add bank' }}
      </AppButton>
    </template>
    <LoadState :loading="loading" :error="error" :ready="banks !== null" @retry="reload">
      <AppCard :title="mixes ? 'Available mixes' : undefined">
        <p
          v-if="inService.length === 0"
          class="py-4 text-center text-slate-500 dark:text-slate-400"
        >
          {{
            mixes
              ? 'No mixes yet. Add one, then fill it from your banks.'
              : 'No banks yet. Add the O2 and He banks of your blending room.'
          }}
        </p>
        <ul v-else class="-mx-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="bank in inService" :key="bank.vesselId">
            <BankListItem :bank="bank" :team-id="teamId" :currency="team.currency" />
          </li>
        </ul>
      </AppCard>
      <details v-if="closed.length" class="rounded-2xl bg-white shadow-sm dark:bg-slate-900">
        <summary
          class="flex min-h-11 cursor-pointer items-center px-4 py-3 font-medium text-slate-800 dark:text-slate-200"
        >
          Closed {{ mixes ? 'mixes' : 'banks' }} ({{ closed.length }})
        </summary>
        <ul class="flex flex-col divide-y divide-slate-100 px-1 pb-2 dark:divide-slate-800">
          <li v-for="bank in closed" :key="bank.vesselId">
            <BankListItem :bank="bank" :team-id="teamId" :currency="team.currency" />
          </li>
        </ul>
      </details>
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import BankListItem from '@/components/bank/BankListItem.vue'
import PageShell from '@/components/layout/PageShell.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useVesselsApi } from '@/lib/api/vessels'
import { isMix } from '@/lib/utils/banks'
import { useTeamStore } from '@/stores/team'
import { computed } from 'vue'

// F4: every bank's level at a glance; closed banks folded away, newest closed first. The Blend
// tab shows the banks holding a mix, the Banks tab all others.
const props = defineProps<{ mixes?: boolean }>()
const team = useTeamStore()
const { teamId } = useTeamRoute()
const {
  data: banks,
  loading,
  error,
  reload,
} = useLoad(() => useVesselsApi().list(teamId.value, 'ALL'))
const shown = computed(() => (banks.value ?? []).filter((bank) => isMix(bank) === props.mixes))
const inService = computed(() => shown.value.filter((bank) => bank.status === 'IN_SERVICE'))
const closed = computed(() =>
  shown.value
    .filter((bank) => bank.status === 'CLOSED')
    .toSorted((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)),
)

void reload()
</script>
