<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <AppCard :title="intoBank ? 'Into a bank' : 'Cylinder'">
      <p v-if="intoBank" class="text-slate-700 dark:text-slate-300">
        Blending into <strong>{{ intoBank.label }}</strong> (change under “More details”).
      </p>
      <div v-else class="flex flex-col gap-3">
        <div class="flex flex-wrap gap-2" role="group" aria-label="Cylinder size">
          <button
            v-for="size in CYLINDER_SIZES"
            :key="size.label"
            type="button"
            class="min-h-11 min-w-16 rounded-full border px-3 text-base font-medium"
            :class="
              draft.waterVolume === size.litres
                ? 'border-sky-600 bg-sky-600 text-white'
                : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
            "
            :aria-pressed="draft.waterVolume === size.litres"
            @click="draft.waterVolume = size.litres"
          >
            {{ size.label }}
          </button>
        </div>
        <TextField
          id="fill-size"
          v-model="draft.waterVolume"
          label="Size"
          unit="L"
          inputmode="decimal"
          hint="Water volume; a twinset counts both cylinders."
          class="max-w-56"
        />
      </div>
    </AppCard>

    <AppCard title="Gases">
      <ol class="flex flex-col gap-3">
        <li
          v-for="(stage, index) in draft.stages"
          :key="stage.key"
          class="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"
        >
          <div class="flex items-end gap-2">
            <SelectField
              :id="`stage-${stage.key}-source`"
              :model-value="sourceKey(stage)"
              :label="`Gas ${index + 1} from`"
              class="min-w-0 flex-1"
              @update:model-value="setSource(stage, $event)"
            >
              <option :value="AIR_KEY">Air (compressor, free)</option>
              <option
                v-for="bank in sourceBanks(stage)"
                :key="bank.vesselId"
                :value="bank.vesselId"
              >
                {{ bankOption(bank) }}
              </option>
            </SelectField>
            <AppButton
              variant="ghost"
              :aria-label="`Remove gas ${index + 1}`"
              @click="draft.stages.splice(index, 1)"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true" />
            </AppButton>
          </div>
          <TextField
            :id="`stage-${stage.key}-after`"
            v-model="stage.pressureAfter"
            :label="`Pressure after gas ${index + 1}`"
            unit="bar"
            inputmode="decimal"
            class="max-w-56"
          />
        </li>
      </ol>
      <p v-if="draft.stages.length === 0" class="text-slate-500 dark:text-slate-400">
        Add the gases in the order you filled them.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <AppButton
          v-for="gas in addableGases"
          :key="gas.label"
          variant="secondary"
          @click="addStage(gas.vesselId)"
        >
          <i class="fa-solid fa-plus" aria-hidden="true" />{{ gas.label }}
        </AppButton>
        <AppButton variant="secondary" @click="addStage(null)">
          <i class="fa-solid fa-plus" aria-hidden="true" />Air
        </AppButton>
      </div>
    </AppCard>

    <AppCard title="Result">
      <div role="status" aria-live="polite" class="min-h-24">
        <p v-if="'problem' in mapped" class="text-slate-500 dark:text-slate-400">
          {{ mapped.problem }}
        </p>
        <p v-else-if="previewError" class="text-red-700 dark:text-red-400">{{ previewError }}</p>
        <div v-else-if="preview" class="flex flex-col gap-2" :class="{ 'opacity-60': previewing }">
          <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {{ formatMoney(preview.totalCharge, team.currency) }}
            </span>
            <span class="text-slate-700 dark:text-slate-300">
              {{ mixLabel(preview.endMix) }} at {{ formatBar(preview.endPressureBar) }}
            </span>
          </p>
          <p v-if="isEstimate" class="text-sm text-amber-700 dark:text-amber-400">
            Estimate: the final price is set when the bank is closed.
          </p>
          <ul class="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
            <li
              v-for="stage in preview.stages"
              :key="stage.index"
              class="flex justify-between gap-2"
            >
              <span class="min-w-0">
                {{ stage.index + 1 }}. {{ stageSourceName(stage.source) }}: +{{
                  formatLitres(stage.addedLitres)
                }}
              </span>
              <span class="shrink-0">{{ formatMoney(stage.charge, team.currency) }}</span>
            </li>
          </ul>
          <ul v-if="preview.warnings.length" class="flex flex-col gap-1">
            <li
              v-for="warning in preview.warnings"
              :key="`${warning.code}-${warning.stageIndex}`"
              class="text-sm text-amber-700 dark:text-amber-400"
            >
              <i class="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true" />
              {{ warning.message }}
            </li>
          </ul>
        </div>
        <p v-else class="text-slate-500 dark:text-slate-400">
          <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />Calculating…
        </p>
      </div>
    </AppCard>

    <details :open="detailsOpen" class="rounded-2xl bg-white shadow-sm dark:bg-slate-900">
      <summary
        class="flex min-h-11 cursor-pointer items-center px-4 py-3 font-medium text-slate-800 dark:text-slate-200"
      >
        More details
      </summary>
      <div class="flex flex-col gap-4 px-4 pb-4">
        <SelectField id="fill-into" v-model="intoKey" label="Fill into">
          <option :value="CYLINDER_KEY">A diver's cylinder</option>
          <option v-for="bank in targetBanks" :key="bank.vesselId" :value="bank.vesselId">
            Bank: {{ bank.label }}
          </option>
        </SelectField>
        <template v-if="!intoBank">
          <SelectField id="fill-charged" v-model="draft.chargedMemberId" label="Charged to">
            <option
              v-for="member in team.selectableMembers"
              :key="member.memberId"
              :value="member.memberId"
            >
              {{ member.displayName }}
            </option>
          </SelectField>
          <TextField
            id="fill-cylinder-label"
            v-model="draft.cylinderLabel"
            label="Cylinder name (optional)"
            placeholder="e.g. D12 #2"
          />
        </template>
        <TextField
          id="fill-start-pressure"
          v-model="draft.startPressure"
          label="Pressure before filling"
          unit="bar"
          inputmode="decimal"
          class="max-w-56"
        />
        <fieldset class="flex flex-col gap-2">
          <legend class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Gas already in it (empty: air)
          </legend>
          <div class="grid grid-cols-2 gap-3">
            <TextField
              id="fill-start-o2"
              v-model="draft.startO2"
              label="O2"
              unit="%"
              inputmode="decimal"
            />
            <TextField
              id="fill-start-he"
              v-model="draft.startHe"
              label="He"
              unit="%"
              inputmode="decimal"
            />
          </div>
        </fieldset>
        <fieldset class="flex flex-col gap-2">
          <legend class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Analyser reading afterwards (optional)
          </legend>
          <div class="grid grid-cols-2 gap-3">
            <TextField
              id="fill-analysis-o2"
              v-model="draft.analysisO2"
              label="O2"
              unit="%"
              inputmode="decimal"
            />
            <TextField
              id="fill-analysis-he"
              v-model="draft.analysisHe"
              label="He"
              unit="%"
              inputmode="decimal"
            />
          </div>
        </fieldset>
        <fieldset v-if="bankStages.length" class="flex flex-col gap-2">
          <legend class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Bank gauge after filling (optional, keeps the bank level exact)
          </legend>
          <TextField
            v-for="{ stage, index } in bankStages"
            :id="`stage-${stage.key}-gauge`"
            :key="stage.key"
            v-model="stage.bankGaugeAfter"
            :label="`Gas ${index + 1}: ${bankName(stage)}`"
            unit="bar"
            inputmode="decimal"
            class="max-w-56"
          />
        </fieldset>
        <TextField
          id="fill-time"
          v-model="draft.filledAt"
          type="datetime-local"
          label="Time"
          hint="Empty: now."
          class="max-w-72"
        />
        <TextField id="fill-notes" v-model="draft.notes" label="Notes" />
      </div>
    </details>

    <AppButton type="submit" :loading="saving">{{ submitLabel }}</AppButton>
  </form>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useFillsApi } from '@/lib/api/fills'
import type { FillInput, FillPreview, StageSource, VesselSummary } from '@/lib/api/types'
import {
  CYLINDER_SIZES,
  STAGE_GASES,
  fullestBank,
  newStage,
  toFillInput,
  type FillDraft,
  type StageDraft,
} from '@/lib/fill/fillForm'
import { formatMoney } from '@/lib/format/money'
import { mixLabel } from '@/lib/format/mix'
import { formatBar, formatLitres } from '@/lib/format/units'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useTeamStore } from '@/stores/team'
import axios from 'axios'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

// The fill form (record and edit): cylinder, gases with "after" pressures, a live preview from
// the backend (debounced), and the rare inputs under "More details" (docs/PLAN.md budget).
const props = defineProps<{
  /** Every bank of the team (closed ones only show up when a stage already uses them). */
  banks: VesselSummary[]
  initial: FillDraft
  submitLabel: string
  saving?: boolean
  detailsOpen?: boolean
  /** Editing this fill: the preview prices the edit as replacing it. */
  replacingFillId?: number
}>()
const emit = defineEmits<{ submit: [input: FillInput] }>()

const AIR_KEY = 0
const CYLINDER_KEY = 0
const PREVIEW_DELAY_MS = 300

const team = useTeamStore()
const { teamId } = useTeamRoute()
const draft = ref<FillDraft>({
  ...props.initial,
  stages: props.initial.stages.map((stage) => ({ ...stage })),
})

const bankById = computed(() => new Map(props.banks.map((bank) => [bank.vesselId, bank])))
const inService = computed(() => props.banks.filter((bank) => bank.status === 'IN_SERVICE'))
const intoBank = computed(() =>
  draft.value.intoVesselId === null ? undefined : bankById.value.get(draft.value.intoVesselId),
)
const intoKey = computed({
  get: () => draft.value.intoVesselId ?? CYLINDER_KEY,
  set: (key: number) => (draft.value.intoVesselId = key === CYLINDER_KEY ? null : key),
})
/** Banks to blend into: in service, plus the current target (edit of an old fill). */
const targetBanks = computed(() =>
  props.banks.filter(
    (bank) => bank.status === 'IN_SERVICE' || bank.vesselId === props.initial.intoVesselId,
  ),
)

const sourceKey = (stage: StageDraft) =>
  stage.source.type === 'VESSEL' ? stage.source.vesselId : AIR_KEY
function setSource(stage: StageDraft, key: number) {
  stage.source = key === AIR_KEY ? { type: 'AIR' } : { type: 'VESSEL', vesselId: key }
}
/** A bank can't feed itself; a closed bank stays listed only where it is already used. */
function sourceBanks(stage: StageDraft): VesselSummary[] {
  return props.banks.filter(
    (bank) =>
      bank.vesselId !== draft.value.intoVesselId &&
      (bank.status === 'IN_SERVICE' || bank.vesselId === sourceKey(stage)),
  )
}
const bankOption = (bank: VesselSummary) =>
  `${bank.label} · ${formatBar(bank.estimatedPressureBar)}`
const bankLabel = (vesselId: number) => bankById.value.get(vesselId)?.label ?? '?'
const bankName = (stage: StageDraft) =>
  stage.source.type === 'VESSEL' ? bankLabel(stage.source.vesselId) : ''
const stageSourceName = (source: StageSource) =>
  source.type === 'VESSEL' ? (source.label ?? bankLabel(source.vesselId)) : 'Air'

/** "+ He", "+ O2", … for each gas the team has a bank of (fullest one preselected). */
const addableGases = computed(() =>
  STAGE_GASES.flatMap(({ gasClass, label }) => {
    const bank = fullestBank(
      inService.value.filter((candidate) => candidate.vesselId !== draft.value.intoVesselId),
      gasClass,
    )
    return bank ? [{ label, vesselId: bank.vesselId }] : []
  }),
)
function addStage(vesselId: number | null) {
  draft.value.stages.push(
    newStage(vesselId === null ? { type: 'AIR' } : { type: 'VESSEL', vesselId }),
  )
}
const bankStages = computed(() =>
  draft.value.stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage.source.type === 'VESSEL'),
)

// --- live preview -------------------------------------------------------------------------
const mapped = computed(() => toFillInput(draft.value))
const preview = ref<FillPreview | null>(null)
const previewError = ref<string | null>(null)
const previewing = ref(false)
const isEstimate = computed(() => preview.value?.stages.some((stage) => stage.isEstimate) ?? false)
let timer: ReturnType<typeof setTimeout> | undefined
let inFlight: AbortController | undefined

async function runPreview(input: FillInput) {
  const controller = new AbortController()
  inFlight = controller
  previewing.value = true
  try {
    preview.value = await useFillsApi().preview(
      teamId.value,
      input,
      controller.signal,
      props.replacingFillId,
    )
    previewError.value = null
  } catch (err) {
    if (controller.signal.aborted || axios.isCancel(err)) return
    preview.value = null
    previewError.value = extractErrorDetail(err)
  } finally {
    if (inFlight === controller) previewing.value = false
  }
}

watch(
  mapped,
  (current) => {
    clearTimeout(timer)
    inFlight?.abort()
    inFlight = undefined
    if ('problem' in current) return
    // the last result stays (dimmed) until the new one arrives: no layout jump while typing
    previewing.value = true
    timer = setTimeout(() => void runPreview(current.input), PREVIEW_DELAY_MS)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  clearTimeout(timer)
  inFlight?.abort()
})

function submit() {
  const current = mapped.value
  if ('problem' in current) {
    toast.error(current.problem)
    return
  }
  emit('submit', current.input)
}
</script>
