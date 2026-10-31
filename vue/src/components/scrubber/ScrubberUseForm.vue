<template>
  <form class="flex flex-col gap-3" novalidate @submit.prevent="submit">
    <SelectField
      v-if="canisters.length > 1"
      id="use-canister"
      v-model="canisterId"
      label="Canister"
    >
      <option v-for="canister in canisters" :key="canister.canisterId" :value="canister.canisterId">
        {{ canister.label }} · ≈ {{ formatKg(canister.remainingKg) }} left
      </option>
    </SelectField>
    <QuickChips v-model="kg" :options="SCOOP_CHIPS" label="Amount" />
    <TextField
      id="use-kg"
      v-model="kg"
      label="Amount"
      unit="kg"
      inputmode="decimal"
      hint="A good guess is fine: the real cost is shared out when the canister is empty."
      class="max-w-56"
    />
    <SelectField id="use-member" v-model="memberId" label="For">
      <option
        v-for="member in team.selectableMembers"
        :key="member.memberId"
        :value="member.memberId"
      >
        {{ member.displayName }}
      </option>
    </SelectField>
    <AppButton type="submit" :loading="saving">Save</AppButton>
  </form>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import QuickChips from '@/components/ui/QuickChips.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useScrubbersApi } from '@/lib/api/scrubbers'
import type { ScrubberCanister } from '@/lib/api/types'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { SCOOP_CHIPS, USUAL_SCOOP_KG, formatKg, scrubberUseOf } from '@/lib/utils/scrubber'
import { useTeamStore } from '@/stores/team'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

// The usual action: which canister, how much (roughly), for whom. Defaults to me, 2.5 kg.
const props = defineProps<{ canisters: ScrubberCanister[]; teamId: number }>()
const emit = defineEmits<{ saved: [canister: ScrubberCanister] }>()

const team = useTeamStore()
const canisterId = ref(props.canisters[0]?.canisterId ?? 0)
const kg = ref(USUAL_SCOOP_KG)
const memberId = ref(team.myMemberId ?? 0)
const saving = ref(false)

watch(
  () => props.canisters,
  (canisters) => {
    if (!canisters.some((canister) => canister.canisterId === canisterId.value)) {
      canisterId.value = canisters[0]?.canisterId ?? 0
    }
  },
)

async function submit() {
  const use = scrubberUseOf(memberId.value, kg.value)
  if (typeof use === 'string') {
    toast.error(use)
    return
  }
  saving.value = true
  try {
    const saved = await useScrubbersApi().addUse(props.teamId, canisterId.value, use)
    toast.success(`Saved: ${formatKg(use.kg)} from ${saved.label}.`)
    kg.value = USUAL_SCOOP_KG
    memberId.value = team.myMemberId ?? 0
    emit('saved', saved)
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}
</script>
