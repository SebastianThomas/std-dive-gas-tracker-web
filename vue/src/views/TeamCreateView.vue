<template>
  <main class="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
    <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Create a team</h1>
    <p class="text-slate-600 dark:text-slate-400">
      A team is the group that shares a blending room and its gas costs.
    </p>
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <AppCard>
        <div class="flex flex-col gap-4">
          <TextField id="team-name" v-model="name" label="Team name" required />
          <LossPolicyChoice v-model="policy" />
          <TextField
            id="team-currency"
            v-model="currency"
            label="Currency"
            hint="Three letters, e.g. CHF or EUR."
          />
        </div>
      </AppCard>
      <AppButton type="submit" :loading="saving">Create team</AppButton>
    </form>
  </main>
</template>

<script setup lang="ts">
import LossPolicyChoice from '@/components/team/LossPolicyChoice.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import TextField from '@/components/ui/TextField.vue'
import { useTeamsApi } from '@/lib/api/teams'
import type { LossPolicy } from '@/lib/api/types'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useSessionStore } from '@/stores/session'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

/** Typical residual of a bank behind a booster; adjustable in the team settings. */
const DEFAULT_RESIDUAL_BAR = 20

const router = useRouter()
const session = useSessionStore()
const name = ref('')
const policy = ref<LossPolicy>('TRUE_UP')
const currency = ref('CHF')
const saving = ref(false)

async function submit() {
  saving.value = true
  try {
    const team = await useTeamsApi().createTeam({
      name: name.value,
      currency: currency.value,
      defaultLossPolicy: policy.value,
      lineDeadVolumeLitres: 0,
      defaultResidualPressureBar: DEFAULT_RESIDUAL_BAR,
    })
    await session.load()
    await router.replace({ name: 'TeamHome', params: { teamId: team.teamId } })
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}
</script>
