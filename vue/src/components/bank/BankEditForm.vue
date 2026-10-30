<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <TextField id="edit-label" v-model="label" label="Name" />
    <TextField
      id="edit-residual"
      v-model="residual"
      label="Pressure left when it goes back"
      unit="bar"
      inputmode="decimal"
      class="max-w-56"
    />
    <TextField id="edit-notes" v-model="notes" label="Notes" />
    <template v-if="team.isAdmin">
      <MixPicker id="edit-mix" v-model="mix" legend="Gas (admins)" />
      <LossPolicyChoice v-if="bank.status === 'IN_SERVICE'" v-model="policy" />
    </template>
    <AppButton type="submit" variant="secondary" :loading="saving">Save changes</AppButton>
  </form>
</template>

<script setup lang="ts">
import MixPicker from '@/components/bank/MixPicker.vue'
import LossPolicyChoice from '@/components/team/LossPolicyChoice.vue'
import AppButton from '@/components/ui/AppButton.vue'
import TextField from '@/components/ui/TextField.vue'
import type { LossPolicy, VesselDetail, VesselUpdate } from '@/lib/api/types'
import { useVesselsApi } from '@/lib/api/vessels'
import { parseDecimal } from '@/lib/format/number'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { choiceOfMix, mixOfChoice, type MixChoice } from '@/lib/utils/banks'
import { useTeamStore } from '@/stores/team'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

// Name, residual and notes (admin or whoever added the bank); gas and loss sharing are admin
// settings and only sent when changed, so a non-admin edit never touches them.
const props = defineProps<{ bank: VesselDetail; teamId: number }>()
const emit = defineEmits<{ changed: [bank: VesselDetail] }>()

const team = useTeamStore()
const label = ref(props.bank.label)
const residual = ref(String(props.bank.expectedResidualPressureBar))
const notes = ref(props.bank.notes ?? '')
const initialMix = choiceOfMix(props.bank.mix)
const mix = ref<MixChoice>(initialMix)
const policy = ref<LossPolicy>(props.bank.lossPolicy)
const saving = ref(false)

async function submit() {
  const expectedResidualPressureBar = parseDecimal(residual.value)
  const gas = mixOfChoice(mix.value)
  if (expectedResidualPressureBar === null || gas === null) {
    toast.error('Enter the pressure in bar and the mix in %.')
    return
  }
  const mixChanged =
    mix.value.kind !== initialMix.kind ||
    (mix.value.kind === 'OTHER' &&
      (mix.value.o2 !== initialMix.o2 || mix.value.he !== initialMix.he))
  const request: VesselUpdate = {
    label: label.value.trim(),
    notes: notes.value.trim(),
    expectedResidualPressureBar,
    ...(team.isAdmin && mixChanged ? { mix: gas } : {}),
    ...(team.isAdmin && policy.value !== props.bank.lossPolicy ? { lossPolicy: policy.value } : {}),
  }
  saving.value = true
  try {
    emit('changed', await useVesselsApi().update(props.teamId, props.bank.vesselId, request))
    toast.success('Bank updated.')
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}
</script>
