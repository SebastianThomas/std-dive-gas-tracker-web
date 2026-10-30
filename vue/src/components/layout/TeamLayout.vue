<template>
  <div class="pb-24">
    <LoadState :loading="loading" :error="error" :ready="ready" @retry="load">
      <RouterView :key="String(teamId)" />
    </LoadState>
    <BottomNav :team-id="teamId" />
  </div>
</template>

<script setup lang="ts">
import BottomNav from '@/components/layout/BottomNav.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useSessionStore } from '@/stores/session'
import { useTeamStore } from '@/stores/team'
import { computed, ref, watch } from 'vue'

// Every /t/:teamId page: loads the team (+ members) for the URL, then shows the page + tab bar.
const { teamId } = useTeamRoute()
const teamStore = useTeamStore()
const session = useSessionStore()
const loading = ref(false)
const error = ref<string | null>(null)
const ready = computed(() => teamStore.teamId === teamId.value)

async function load() {
  loading.value = true
  error.value = null
  try {
    await teamStore.load(teamId.value)
    await session.ensureLoaded()
    session.rememberTeam(teamId.value)
  } catch (err) {
    error.value = extractErrorDetail(err)
  } finally {
    loading.value = false
  }
}

watch(teamId, () => void load(), { immediate: true })
</script>
