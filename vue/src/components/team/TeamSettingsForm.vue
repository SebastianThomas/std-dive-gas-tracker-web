<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <TextField id="settings-name" v-model="name" label="Team name" />
    <fieldset class="flex flex-col">
      <legend class="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        What this team tracks
      </legend>
      <label class="flex min-h-11 items-center gap-3 text-slate-800 dark:text-slate-200">
        <input v-model="gasTracking" type="checkbox" class="size-5 accent-sky-600" />
        Gas fills and banks
      </label>
      <label class="flex min-h-11 items-center gap-3 text-slate-800 dark:text-slate-200">
        <input v-model="scrubberTracking" type="checkbox" class="size-5 accent-sky-600" />
        Scrubber
      </label>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Switching one off hides it and stops new records; what it already charged stays in the
        balances.
      </p>
    </fieldset>
    <LossPolicyChoice v-if="gasTracking" v-model="policy" />
    <p v-if="gasTracking" class="-mt-2 text-sm text-slate-500 dark:text-slate-400">
      Applies to banks added from now on; each bank keeps its own setting.
    </p>
    <TextField
      v-if="gasTracking"
      id="settings-residual"
      v-model="residual"
      label="Usual pressure left in a bank when it goes back"
      unit="bar"
      inputmode="decimal"
      hint="About your highest fill pressure ÷ the booster's ratio, e.g. 230 ÷ 10 ≈ 23 bar."
      class="max-w-56"
    />
    <TextField
      v-if="gasTracking"
      id="settings-dead-volume"
      v-model="deadVolume"
      label="Filling line volume"
      unit="L"
      inputmode="decimal"
      hint="Gas vented from the whip after each bank; 0 if you don't count it."
      class="max-w-56"
    />
    <TextField id="settings-currency" v-model="currency" label="Currency" class="max-w-56" />
    <AppButton type="submit" variant="secondary" :loading="saving">Save settings</AppButton>
  </form>
</template>

<script setup lang="ts">
import LossPolicyChoice from '@/components/team/LossPolicyChoice.vue'
import AppButton from '@/components/ui/AppButton.vue'
import TextField from '@/components/ui/TextField.vue'
import { useTeamsApi } from '@/lib/api/teams'
import type { LossPolicy, Team } from '@/lib/api/types'
import { parseDecimal } from '@/lib/format/number'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useSessionStore } from '@/stores/session'
import { useTeamStore } from '@/stores/team'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

// Admin: the team's defaults (API.md §1 TeamInput is sent whole).
const props = defineProps<{ team: Team }>()
const teamStore = useTeamStore()
const session = useSessionStore()
const name = ref(props.team.name)
const policy = ref<LossPolicy>(props.team.defaultLossPolicy)
const residual = ref(String(props.team.defaultResidualPressureBar))
const deadVolume = ref(String(props.team.lineDeadVolumeLitres))
const currency = ref(props.team.currency)
const gasTracking = ref(props.team.gasTrackingEnabled)
const scrubberTracking = ref(props.team.scrubberTrackingEnabled)
const saving = ref(false)

async function submit() {
  const defaultResidualPressureBar = parseDecimal(residual.value)
  const lineDeadVolumeLitres = parseDecimal(deadVolume.value)
  if (defaultResidualPressureBar === null || lineDeadVolumeLitres === null) {
    toast.error('Enter the pressure in bar and the line volume in litres.')
    return
  }
  saving.value = true
  try {
    await useTeamsApi().updateTeam(props.team.teamId, {
      name: name.value.trim(),
      currency: currency.value.trim().toUpperCase(),
      defaultLossPolicy: policy.value,
      defaultResidualPressureBar,
      lineDeadVolumeLitres,
      gasTrackingEnabled: gasTracking.value,
      scrubberTrackingEnabled: scrubberTracking.value,
    })
    await Promise.all([teamStore.load(props.team.teamId), session.load()])
    toast.success('Settings saved.')
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}
</script>
