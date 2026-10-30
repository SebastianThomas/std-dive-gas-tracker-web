<template>
  <PageShell :title="bank?.label ?? 'Bank'" :back="{ name: 'BankList', params: { teamId } }">
    <LoadState :loading="loading" :error="error" :ready="bank !== null" @retry="reload">
      <template v-if="bank">
        <AppCard>
          <p class="flex flex-wrap items-baseline justify-between gap-x-3">
            <span class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {{ formatBar(bank.closingPressureBar ?? bank.estimatedPressureBar) }}
            </span>
            <span class="text-slate-700 dark:text-slate-300">
              {{ mixLabel(bank.mix) }} · {{ formatWaterVolume(bank.waterVolumeLitres) }}
            </span>
          </p>
          <LevelBar
            v-if="bank.status === 'IN_SERVICE'"
            class="mt-2"
            :pressure-bar="bank.estimatedPressureBar"
            :low="isLow(bank)"
          />
          <dl
            class="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300"
          >
            <template v-if="bank.status === 'IN_SERVICE'">
              <dt>Usable gas</dt>
              <dd class="text-right">{{ formatLitres(bank.usableContentLitres) }}</dd>
            </template>
            <dt>Price</dt>
            <dd class="text-right">
              {{ formatUnitPrice(bank.rate, team.currency) }}
              <span v-if="bank.rateIsEstimate" class="text-amber-700 dark:text-amber-400"
                >estimate</span
              >
            </dd>
            <dt>Losses</dt>
            <dd class="text-right">{{ lossPolicyLabel(bank.lossPolicy) }}</dd>
            <dt>In use since</dt>
            <dd class="text-right">{{ formatDate(bank.openedAt) }}</dd>
            <template v-if="bank.closedAt">
              <dt>Closed</dt>
              <dd class="text-right">
                {{ formatDate(bank.closedAt) }} at {{ formatBar(bank.closingPressureBar ?? 0) }}
              </dd>
            </template>
          </dl>
          <p v-if="bank.rateIsEstimate" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            The price is an estimate until the bank is closed; fills from it are re-priced then.
          </p>
          <p v-if="bank.notes" class="mt-2 break-words text-slate-700 dark:text-slate-300">
            {{ bank.notes }}
          </p>
        </AppCard>

        <AppCard v-if="bank.lossReport" title="Losses">
          <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300">
            <dt>Gas in</dt>
            <dd class="text-right">{{ formatLitres(bank.lossReport.inflowLitres) }}</dd>
            <dt>Filled into cylinders</dt>
            <dd class="text-right">{{ formatLitres(bank.lossReport.drawnLitres) }}</dd>
            <dt>Lost in the lines</dt>
            <dd class="text-right">{{ formatLitres(bank.lossReport.lineLossLitres) }}</dd>
            <dt>Left when closed</dt>
            <dd class="text-right">{{ formatLitres(bank.lossReport.residualLitres) }}</dd>
            <dt>Unaccounted</dt>
            <dd class="text-right">{{ formatLitres(bank.lossReport.unaccountedLitres) }}</dd>
            <dt class="font-medium">Lost overall</dt>
            <dd class="text-right font-medium">
              {{ formatPercent(bank.lossReport.lossFraction) }}
            </dd>
            <template v-if="bank.lossReport.lossAmount">
              <dt>Shared by the team</dt>
              <dd class="text-right">
                {{ formatMoney(bank.lossReport.lossAmount, team.currency) }}
              </dd>
            </template>
            <template v-if="bank.lossReport.writeOffAmount">
              <dt>Written off (nobody filled)</dt>
              <dd class="text-right">
                {{ formatMoney(bank.lossReport.writeOffAmount, team.currency) }}
              </dd>
            </template>
          </dl>
        </AppCard>

        <AppCard title="Gauge readings">
          <form
            v-if="bank.status === 'IN_SERVICE'"
            class="flex flex-wrap items-end gap-3"
            novalidate
            @submit.prevent="addReading"
          >
            <TextField
              id="reading-pressure"
              v-model="readingPressure"
              label="Bank gauge now"
              unit="bar"
              inputmode="decimal"
              class="w-44"
            />
            <AppButton type="submit" variant="secondary" :loading="savingReading"
              >Save reading</AppButton
            >
          </form>
          <p
            v-if="bank.status === 'IN_SERVICE'"
            class="mt-1 text-sm text-slate-500 dark:text-slate-400"
          >
            A reading corrects the estimated level (leaks, unrecorded fills).
          </p>
          <p v-if="readings.length === 0" class="mt-2 text-slate-500 dark:text-slate-400">
            No readings yet.
          </p>
          <ul v-else class="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            <li
              v-for="reading in readings"
              :key="reading.readingId"
              class="flex justify-between gap-2 py-2"
            >
              <span class="flex min-w-0 flex-col">
                <span class="text-slate-900 dark:text-slate-100">{{
                  formatBar(reading.pressureBar)
                }}</span>
                <span class="truncate text-sm text-slate-500 dark:text-slate-400">
                  {{ formatDateTime(reading.measuredAt) }} · {{ reading.createdBy.displayName }}
                </span>
              </span>
              <span class="shrink-0 text-right text-sm text-slate-500 dark:text-slate-400">
                expected {{ formatBar(reading.bookPressureBar) }}
              </span>
            </li>
          </ul>
        </AppCard>

        <BankCosts :bank="bank" :team-id="teamId" @changed="bank = $event" />

        <details v-if="canEdit" class="rounded-2xl bg-white shadow-sm dark:bg-slate-900">
          <summary
            class="flex min-h-11 cursor-pointer items-center px-4 py-3 font-medium text-slate-800 dark:text-slate-200"
          >
            Edit bank
          </summary>
          <div class="px-4 pb-4">
            <BankEditForm
              :key="bank.vesselId"
              :bank="bank"
              :team-id="teamId"
              @changed="bank = $event"
            />
          </div>
        </details>

        <div class="flex flex-wrap gap-2">
          <ConfirmAction
            v-if="bank.status === 'IN_SERVICE' && canEdit"
            v-model:open="confirmClose"
            label="Close bank"
            message="Close the bank when it goes back to the supplier. Its final price is then fixed and every fill from it is re-priced."
            confirm-label="Close bank"
            :busy="busy"
            @confirm="close"
          >
            <TextField
              id="close-pressure"
              v-model="closingPressure"
              label="Pressure left"
              unit="bar"
              inputmode="decimal"
              class="max-w-56"
            />
          </ConfirmAction>
          <AppButton
            v-if="bank.status === 'CLOSED' && team.isAdmin"
            variant="secondary"
            :loading="busy"
            @click="reopen"
          >
            Reopen bank
          </AppButton>
          <AppButton variant="link" :to="{ name: 'FillRecord', params: { teamId } }"
            >Record a fill</AppButton
          >
        </div>
      </template>
    </LoadState>
  </PageShell>
</template>

<script setup lang="ts">
import BankCosts from '@/components/bank/BankCosts.vue'
import BankEditForm from '@/components/bank/BankEditForm.vue'
import LevelBar from '@/components/bank/LevelBar.vue'
import PageShell from '@/components/layout/PageShell.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import ConfirmAction from '@/components/ui/ConfirmAction.vue'
import LoadState from '@/components/ui/LoadState.vue'
import TextField from '@/components/ui/TextField.vue'
import { useLoad } from '@/composables/useLoad'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useVesselsApi } from '@/lib/api/vessels'
import { formatDate, formatDateTime } from '@/lib/format/dates'
import { mixLabel } from '@/lib/format/mix'
import { formatMoney, formatUnitPrice } from '@/lib/format/money'
import { parseDecimal } from '@/lib/format/number'
import { formatBar, formatLitres, formatPercent, formatWaterVolume } from '@/lib/format/units'
import { lossPolicyLabel } from '@/lib/format/words'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { isLow } from '@/lib/utils/banks'
import { useTeamStore } from '@/stores/team'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

// F4: one bank: level, price, readings, costs, losses once closed; edit/close for an admin or
// whoever added it, reopen for admins (DOMAIN §10).
const team = useTeamStore()
const route = useRoute()
const { teamId } = useTeamRoute()
const vesselId = computed(() => Number(route.params.vesselId))
const {
  data: bank,
  loading,
  error,
  reload,
} = useLoad(() => useVesselsApi().get(teamId.value, vesselId.value))
const readingPressure = ref('')
const savingReading = ref(false)
const closingPressure = ref('')
const confirmClose = ref(false)
const busy = ref(false)

const canEdit = computed(() => team.isAdmin || bank.value?.createdBy.memberId === team.myMemberId)
const readings = computed(() =>
  (bank.value?.readings ?? []).toSorted((a, b) => b.measuredAt - a.measuredAt),
)

async function addReading() {
  const pressureBar = parseDecimal(readingPressure.value)
  if (pressureBar === null) {
    toast.error('Enter the gauge pressure in bar.')
    return
  }
  savingReading.value = true
  try {
    bank.value = await useVesselsApi().addReading(teamId.value, vesselId.value, { pressureBar })
    readingPressure.value = ''
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    savingReading.value = false
  }
}

async function close() {
  const pressure = parseDecimal(closingPressure.value)
  if (pressure === null) {
    toast.error('Enter the pressure left in the bank.')
    return
  }
  busy.value = true
  try {
    bank.value = await useVesselsApi().close(teamId.value, vesselId.value, pressure)
    confirmClose.value = false
    toast.success('Bank closed; its fills now have their final price.')
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busy.value = false
  }
}

async function reopen() {
  busy.value = true
  try {
    bank.value = await useVesselsApi().reopen(teamId.value, vesselId.value)
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busy.value = false
  }
}

void reload()
</script>
