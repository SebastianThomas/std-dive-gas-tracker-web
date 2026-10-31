<template>
  <main class="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
    <LoadState :loading="loading" :error="error" :ready="preview !== null" @retry="reload">
      <AppCard v-if="preview">
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {{ preview.alreadyMember ? "You're in" : 'Join the team' }}
        </h1>
        <p class="mt-2 break-words text-lg text-slate-800 dark:text-slate-200">
          {{ preview.teamName }}
        </p>
        <p v-if="!preview.alreadyMember" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Teammates will see your username and your name in the team, not your email.
        </p>
        <AppButton class="mt-4 w-full" :loading="joining" @click="join">
          {{ preview.alreadyMember ? 'Open team' : 'Join team' }}
        </AppButton>
      </AppCard>
    </LoadState>
  </main>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import LoadState from '@/components/ui/LoadState.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamsApi } from '@/lib/api/teams'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useSessionStore } from '@/stores/session'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

// An invite link: which team it leads to, then one tap to join. Not signed in: login comes first.
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const token = computed(() => String(route.params.token))
const {
  data: preview,
  loading,
  error,
  reload,
} = useLoad(() => useTeamsApi().previewInvite(token.value))
const joining = ref(false)

async function join() {
  joining.value = true
  try {
    const joined = await useTeamsApi().joinByInvite(token.value)
    await session.load()
    await router.replace({ name: 'TeamHome', params: { teamId: joined.teamId } })
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    joining.value = false
  }
}

void reload()
</script>
