<template>
  <PageShell title="Fill" :back="{ name: 'FillList', params: { teamId } }">
    <LoadState :loading="loading" :error="error" :ready="fill !== null" @retry="reload">
      <template v-if="fill">
        <p
          v-if="fill.status === 'VOIDED'"
          role="status"
          class="rounded-xl bg-slate-200 p-3 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
        >
          <i class="fa-solid fa-ban mr-2" aria-hidden="true" />Voided: {{ fill.voidReason }}
        </p>

        <template v-if="editing && banks">
          <FillForm
            :banks="banks"
            :initial="draftFromFill(fill)"
            :replacing-fill-id="fill.fillId"
            submit-label="Save changes"
            :saving="saving"
            details-open
            @submit="saveEdit"
          />
          <AppButton variant="secondary" @click="editing = false">Cancel</AppButton>
        </template>

        <template v-else>
          <AppCard>
            <p class="flex flex-wrap items-baseline gap-x-3">
              <span class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {{ formatMoney(fill.totalCharge, team.currency) }}
              </span>
              <span class="text-slate-700 dark:text-slate-300">
                {{ mixLabel(fill.endMix) }} at {{ formatBar(fill.endPressureBar) }}
              </span>
            </p>
            <p v-if="isEstimate" class="mt-1 text-sm text-amber-700 dark:text-amber-400">
              Estimate: the final price is set when the bank is closed.
            </p>
            <dl
              class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300"
            >
              <dt class="text-slate-500 dark:text-slate-400">Into</dt>
              <dd>{{ targetText }}</dd>
              <template v-if="fill.chargedMember">
                <dt class="text-slate-500 dark:text-slate-400">Charged to</dt>
                <dd>{{ fill.chargedMember.displayName }}</dd>
              </template>
              <dt class="text-slate-500 dark:text-slate-400">When</dt>
              <dd>{{ formatDateTime(fill.filledAt) }}</dd>
              <dt class="text-slate-500 dark:text-slate-400">Before</dt>
              <dd>{{ formatBar(fill.startPressureBar) }}, {{ mixLabel(fill.startMix) }}</dd>
              <template v-if="fill.endAnalysis">
                <dt class="text-slate-500 dark:text-slate-400">Analysed</dt>
                <dd>{{ mixLabel(fill.endAnalysis) }}</dd>
              </template>
              <dt class="text-slate-500 dark:text-slate-400">Recorded by</dt>
              <dd>{{ fill.recordedBy.displayName }}</dd>
              <template v-if="fill.notes">
                <dt class="text-slate-500 dark:text-slate-400">Notes</dt>
                <dd class="break-words">{{ fill.notes }}</dd>
              </template>
            </dl>
          </AppCard>

          <AppCard title="Gases">
            <ol class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              <li
                v-for="stage in fill.stages"
                :key="stage.index"
                class="flex flex-col gap-0.5 py-2"
              >
                <span
                  class="flex justify-between gap-2 font-medium text-slate-900 dark:text-slate-100"
                >
                  <span class="min-w-0">
                    {{ stage.index + 1 }}.
                    {{ stage.source.type === 'VESSEL' ? stage.source.label : 'Air' }}
                    → {{ formatBar(stage.pressureAfterBar) }}
                  </span>
                  <span class="shrink-0">{{ formatMoney(stage.charge, team.currency) }}</span>
                </span>
                <span class="text-sm text-slate-500 dark:text-slate-400">
                  +{{ formatLitres(stage.addedLitres) }}
                  <template v-if="stage.addedHeLitres > 0">
                    ({{ formatLitres(stage.addedHeLitres) }} He)</template
                  ><template v-else-if="stage.addedO2Litres > 0 && stage.source.type === 'VESSEL'">
                    ({{ formatLitres(stage.addedO2Litres) }} O2)</template
                  ><template v-if="stage.sourcePressureAfterBar !== undefined">
                    · bank gauge {{ formatBar(stage.sourcePressureAfterBar) }}</template
                  >
                </span>
              </li>
            </ol>
            <ul v-if="fill.warnings.length" class="mt-2 flex flex-col gap-1">
              <li
                v-for="warning in fill.warnings"
                :key="`${warning.code}-${warning.stageIndex}`"
                class="text-sm text-amber-700 dark:text-amber-400"
              >
                <i class="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true" />
                {{ warning.message }}
              </li>
            </ul>
          </AppCard>

          <div v-if="canChange" class="flex flex-wrap items-start gap-2">
            <AppButton variant="secondary" :loading="loadingBanks" @click="startEdit">
              <i class="fa-solid fa-pen" aria-hidden="true" />Edit
            </AppButton>
            <ConfirmAction
              v-model:open="confirmVoid"
              label="Void"
              message="Voiding takes this fill out of all balances and bank levels. It stays listed as voided."
              confirm-label="Void fill"
              :busy="saving"
              @confirm="voidFill"
            >
              <TextField
                id="void-reason"
                v-model="voidReason"
                label="Reason"
                placeholder="e.g. recorded twice"
              />
            </ConfirmAction>
          </div>
        </template>
      </template>
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import FillForm from '@/components/fill/FillForm.vue'
import PageShell from '@/components/layout/PageShell.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import ConfirmAction from '@/components/ui/ConfirmAction.vue'
import LoadState from '@/components/ui/LoadState.vue'
import TextField from '@/components/ui/TextField.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useFillsApi } from '@/lib/api/fills'
import type { FillInput, VesselSummary } from '@/lib/api/types'
import { useVesselsApi } from '@/lib/api/vessels'
import { draftFromFill } from '@/lib/fill/fillForm'
import { formatDateTime } from '@/lib/format/dates'
import { mixLabel } from '@/lib/format/mix'
import { formatMoney } from '@/lib/format/money'
import { formatBar, formatLitres, formatWaterVolume } from '@/lib/format/units'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useTeamStore } from '@/stores/team'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

// F5: one fill; its recorder, the charged diver or an admin may edit or void it (DOMAIN §10).
const team = useTeamStore()
const route = useRoute()
const { teamId } = useTeamRoute()
const fillId = computed(() => Number(route.params.fillId))
const {
  data: fill,
  loading,
  error,
  reload,
} = useLoad(() => useFillsApi().get(teamId.value, fillId.value))
const banks = ref<VesselSummary[] | null>(null)
const editing = ref(false)
const loadingBanks = ref(false)
const saving = ref(false)
const confirmVoid = ref(false)
const voidReason = ref('')

const isEstimate = computed(() => fill.value?.stages.some((stage) => stage.isEstimate) ?? false)
const targetText = computed(() => {
  const target = fill.value?.target
  if (!target) return ''
  if (target.type === 'VESSEL') return `Bank ${target.vesselLabel ?? ''}`
  const size = `${formatWaterVolume(target.waterVolumeLitres)} cylinder`
  return target.cylinderLabel ? `${target.cylinderLabel} (${size})` : size
})
const canChange = computed(() => {
  const current = fill.value
  if (!current || current.status === 'VOIDED') return false
  const me = team.myMemberId
  return (
    team.isAdmin || current.recordedBy.memberId === me || current.chargedMember?.memberId === me
  )
})

async function startEdit() {
  loadingBanks.value = true
  try {
    banks.value = await useVesselsApi().list(teamId.value, 'ALL')
    editing.value = true
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    loadingBanks.value = false
  }
}

async function saveEdit(input: FillInput) {
  saving.value = true
  try {
    fill.value = await useFillsApi().update(teamId.value, fillId.value, input)
    editing.value = false
    toast.success('Fill updated.')
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}

async function voidFill() {
  saving.value = true
  try {
    fill.value = await useFillsApi().void(teamId.value, fillId.value, voidReason.value.trim())
    confirmVoid.value = false
    toast.success('Fill voided.')
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}

void reload()
</script>
