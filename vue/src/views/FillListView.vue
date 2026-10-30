<template>
  <PageShell title="Fills" :back="{ name: 'FillRecord', params: { teamId } }">
    <AppCard>
      <LoadState
        :loading="loading"
        :error="error"
        :ready="fills.length > 0 || loaded"
        @retry="loadPage(0)"
      >
        <p v-if="fills.length === 0" class="py-4 text-center text-slate-500 dark:text-slate-400">
          No fills yet.
        </p>
        <ul v-else class="-mx-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="fill in fills" :key="fill.fillId">
            <FillListItem :fill="fill" :team-id="teamId" :currency="team.currency" show-member />
          </li>
        </ul>
        <AppButton
          v-if="hasMore"
          variant="secondary"
          class="mt-3 w-full"
          :loading="loading"
          @click="loadPage(page + 1)"
        >
          Show older fills
        </AppButton>
      </LoadState>
    </AppCard>
  </PageShell>
</template>

<script setup lang="ts">
import FillListItem from '@/components/fill/FillListItem.vue'
import PageShell from '@/components/layout/PageShell.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useFillsApi } from '@/lib/api/fills'
import type { FillSummary } from '@/lib/api/types'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useTeamStore } from '@/stores/team'
import { ref } from 'vue'

// Everyone's fills, newest first, a page at a time.
const PAGE_SIZE = 30

const team = useTeamStore()
const { teamId } = useTeamRoute()
const fills = ref<FillSummary[]>([])
const page = ref(0)
const hasMore = ref(false)
const loaded = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

async function loadPage(next: number) {
  loading.value = true
  error.value = null
  try {
    const result = await useFillsApi().list(teamId.value, { page: next, size: PAGE_SIZE })
    fills.value = next === 0 ? result.result : [...fills.value, ...result.result]
    page.value = result.page
    hasMore.value = result.page + 1 < result.totalPages
    loaded.value = true
  } catch (err) {
    error.value = extractErrorDetail(err)
  } finally {
    loading.value = false
  }
}

void loadPage(0)
</script>
