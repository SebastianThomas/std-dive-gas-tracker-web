<template>
  <PageShell title="Scrubber">
    <template #actions>
      <AppButton variant="secondary" :to="{ name: 'ScrubberCreate', params: { teamId } }">
        <i class="fa-solid fa-plus" aria-hidden="true" />Add canister
      </AppButton>
    </template>
    <LoadState :loading="loading" :error="error" :ready="canisters !== null" @retry="reload">
      <AppCard v-if="open.length" title="Record use">
        <ScrubberUseForm :canisters="open" :team-id="teamId" @saved="reload" />
      </AppCard>
      <AppCard title="Canisters">
        <p v-if="open.length === 0" class="py-4 text-center text-slate-500 dark:text-slate-400">
          No canister in use. Add one to start recording.
        </p>
        <ul v-else class="-mx-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="canister in open" :key="canister.canisterId">
            <CanisterListItem :canister="canister" :team-id="teamId" :currency="team.currency" />
          </li>
        </ul>
      </AppCard>
      <details v-if="emptied.length" class="rounded-2xl bg-white shadow-sm dark:bg-slate-900">
        <summary
          class="flex min-h-11 cursor-pointer items-center px-4 py-3 font-medium text-slate-800 dark:text-slate-200"
        >
          Empty canisters ({{ emptied.length }})
        </summary>
        <ul class="flex flex-col divide-y divide-slate-100 px-1 pb-2 dark:divide-slate-800">
          <li v-for="canister in emptied" :key="canister.canisterId">
            <CanisterListItem :canister="canister" :team-id="teamId" :currency="team.currency" />
          </li>
        </ul>
      </details>
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import PageShell from '@/components/layout/PageShell.vue'
import CanisterListItem from '@/components/scrubber/CanisterListItem.vue'
import ScrubberUseForm from '@/components/scrubber/ScrubberUseForm.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useScrubbersApi } from '@/lib/api/scrubbers'
import { openCanisters } from '@/lib/utils/scrubber'
import { useTeamStore } from '@/stores/team'
import { computed } from 'vue'

// CO2 absorbent, separate from gas: record a scoop, see what is left; empty canisters folded away.
const team = useTeamStore()
const { teamId } = useTeamRoute()
const {
  data: canisters,
  loading,
  error,
  reload,
} = useLoad(() => useScrubbersApi().list(teamId.value))
const open = computed(() => openCanisters(canisters.value ?? []))
const emptied = computed(() =>
  (canisters.value ?? [])
    .filter((canister) => canister.status === 'EMPTY')
    .toSorted((a, b) => (b.emptiedAt ?? 0) - (a.emptiedAt ?? 0)),
)

void reload()
</script>
