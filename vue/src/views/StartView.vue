<template>
  <main class="mx-auto max-w-md px-4 py-16 text-center" role="status">
    <p v-if="error" class="text-slate-700 dark:text-slate-300">{{ error }}</p>
    <p v-else class="text-slate-500 dark:text-slate-400">
      <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />Loading…
    </p>
  </main>
</template>

<script setup lang="ts">
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useSessionStore } from '@/stores/session'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

// "/": the team used last on this device, else the first team, else create one.
const router = useRouter()
const session = useSessionStore()
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const me = await session.load()
    const teamId = session.lastTeamId() ?? me.teams[0]?.teamId
    await router.replace(
      teamId === undefined ? { name: 'TeamCreate' } : { name: 'TeamHome', params: { teamId } },
    )
  } catch (err) {
    error.value = extractErrorDetail(err)
  }
})
</script>
