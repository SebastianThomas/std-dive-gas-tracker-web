<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <AppCard title="How far the bank went down">
      <div class="flex flex-col gap-4">
        <SelectField
          id="draw-bank"
          :model-value="draft.vesselId"
          label="Bank"
          @update:model-value="pickBank"
        >
          <option v-for="bank in selectableBanks" :key="bank.vesselId" :value="bank.vesselId">
            {{ bank.label }} · {{ mixLabel(bank.mix) }}
          </option>
        </SelectField>
        <TextField
          id="draw-before"
          v-model="draft.before"
          label="Bank pressure before"
          unit="bar"
          inputmode="decimal"
          class="max-w-56"
        />
        <TextField
          id="draw-after"
          v-model="draft.after"
          label="Bank pressure now"
          unit="bar"
          inputmode="decimal"
          class="max-w-56"
        />
      </div>
    </AppCard>

    <FillResultCard
      :problem="'problem' in mapped ? mapped.problem : undefined"
      :preview="preview"
      :error="previewError"
      :previewing="previewing"
      :is-estimate="isEstimate"
      bank-draw
    />

    <details :open="detailsOpen" class="rounded-2xl bg-white shadow-sm dark:bg-slate-900">
      <summary
        class="flex min-h-11 cursor-pointer items-center px-4 py-3 font-medium text-slate-800 dark:text-slate-200"
      >
        More details
      </summary>
      <div class="flex flex-col gap-4 px-4 pb-4">
        <SelectField id="draw-charged" v-model="draft.chargedMemberId" label="Charged to">
          <option
            v-for="member in team.selectableMembers"
            :key="member.memberId"
            :value="member.memberId"
          >
            {{ member.displayName }}
          </option>
        </SelectField>
        <TextField
          id="draw-time"
          v-model="draft.filledAt"
          type="datetime-local"
          label="Time"
          hint="Empty: now."
          class="max-w-72"
        />
        <TextField id="draw-notes" v-model="draft.notes" label="Notes" />
      </div>
    </details>

    <AppButton type="submit" :loading="saving">{{ submitLabel }}</AppButton>
  </form>
</template>

<script setup lang="ts">
import FillResultCard from '@/components/fill/FillResultCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useFillPreview } from '@/composables/useFillPreview'
import type { FillInput, VesselSummary } from '@/lib/api/types'
import { gaugeOf, toBankDrawInput, type BankDrawDraft } from '@/lib/fill/fillForm'
import { mixLabel } from '@/lib/format/mix'
import { useTeamStore } from '@/stores/team'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

// A fill known only from the bank's gauge: which bank, its pressure before and now, for whom.
const props = defineProps<{
  /** Every bank of the team (a closed one only shows up when an edited fill already uses it). */
  banks: VesselSummary[]
  initial: BankDrawDraft
  submitLabel: string
  saving?: boolean
  detailsOpen?: boolean
  /** Editing this fill: the preview prices the edit as replacing it. */
  replacingFillId?: number
}>()
const emit = defineEmits<{ submit: [input: FillInput] }>()

const team = useTeamStore()
const draft = ref<BankDrawDraft>({ ...props.initial })
const selectableBanks = computed(() =>
  props.banks.filter(
    (bank) => bank.status === 'IN_SERVICE' || bank.vesselId === props.initial.vesselId,
  ),
)

/** Another bank: "before" starts from that bank's level, like the default one. */
function pickBank(vesselId: number) {
  const bank = props.banks.find((candidate) => candidate.vesselId === vesselId)
  draft.value = { ...draft.value, vesselId, before: bank ? gaugeOf(bank) : '' }
}

const mapped = computed(() => toBankDrawInput(draft.value))
const { preview, previewError, previewing, isEstimate } = useFillPreview(
  mapped,
  props.replacingFillId,
)

function submit() {
  const current = mapped.value
  if ('problem' in current) {
    toast.error(current.problem)
    return
  }
  emit('submit', current.input)
}
</script>
