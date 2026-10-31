<template>
  <PageShell
    :title="mixes ? 'Add a mix' : 'Add a bank'"
    :back="{ name: mixes ? 'MixList' : 'BankList', params: { teamId } }"
  >
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <AppCard>
        <div class="flex flex-col gap-4">
          <TextField
            id="bank-label"
            v-model="label"
            label="Name"
            :placeholder="mixes ? 'e.g. 21/35 for Saturday' : 'e.g. O2 bank #3'"
            required
          />
          <MixPicker id="bank-mix" v-model="mix" :only-mix="mixes" />
          <TextField
            id="bank-size"
            v-model="size"
            label="Size"
            unit="L"
            inputmode="decimal"
            hint="Total water volume, e.g. 50 L per bottle."
            class="max-w-56"
          />
          <TextField
            id="bank-pressure"
            v-model="pressure"
            label="Pressure now"
            unit="bar"
            inputmode="decimal"
            class="max-w-56"
          />
        </div>
      </AppCard>

      <AppCard v-if="!mixes" title="Cost (optional)">
        <CostPayers v-model="payments" />
      </AppCard>

      <details class="rounded-2xl bg-white shadow-sm dark:bg-slate-900">
        <summary
          class="flex min-h-11 cursor-pointer items-center px-4 py-3 font-medium text-slate-800 dark:text-slate-200"
        >
          More details
        </summary>
        <div class="flex flex-col gap-4 px-4 pb-4">
          <TextField
            id="bank-residual"
            v-model="residual"
            label="Pressure left when it goes back"
            unit="bar"
            inputmode="decimal"
            hint="What the booster can't get out; counts as loss."
            class="max-w-56"
          />
          <LossPolicyChoice v-model="policy" />
          <TextField
            id="bank-opened"
            v-model="openedAt"
            type="datetime-local"
            label="In use since"
            hint="Empty: now."
            class="max-w-72"
          />
          <TextField id="bank-notes" v-model="notes" label="Notes" />
        </div>
      </details>

      <AppButton type="submit" :loading="saving">{{ mixes ? 'Add mix' : 'Add bank' }}</AppButton>
    </form>
  </PageShell>
</template>

<script setup lang="ts">
import CostPayers from '@/components/bank/CostPayers.vue'
import MixPicker from '@/components/bank/MixPicker.vue'
import PageShell from '@/components/layout/PageShell.vue'
import LossPolicyChoice from '@/components/team/LossPolicyChoice.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import TextField from '@/components/ui/TextField.vue'
import { useTeamRoute } from '@/composables/useTeamRoute'
import type { LossPolicy, VesselCreate } from '@/lib/api/types'
import { useVesselsApi } from '@/lib/api/vessels'
import { fromLocalInput } from '@/lib/format/dates'
import { parseDecimal } from '@/lib/format/number'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import {
  bankDetailRoute,
  costLinesOf,
  mixOfChoice,
  newCostRow,
  type CostRow,
  type MixChoice,
} from '@/lib/utils/banks'
import { useTeamStore } from '@/stores/team'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

// F4: a new bank with what it holds now and what it cost; the rest defaults from the team. A mix
// starts empty and gets its gas (and its price) from the fills into it, so it asks for no cost.
const props = defineProps<{ mixes?: boolean }>()
const router = useRouter()
const team = useTeamStore()
const { teamId } = useTeamRoute()
const label = ref('')
const mix = ref<MixChoice>({ kind: props.mixes ? 'OTHER' : 'OXYGEN', o2: '', he: '' })
const size = ref('50')
const pressure = ref('')
const payments = ref<CostRow[]>([newCostRow(team.myMemberId ?? 0)])
const residual = ref(String(team.team?.defaultResidualPressureBar ?? ''))
const policy = ref<LossPolicy>(team.team?.defaultLossPolicy ?? 'TRUE_UP')
const openedAt = ref('')
const notes = ref('')
const saving = ref(false)

/** The form as a request, or the first thing to fix. */
function request(): VesselCreate | string {
  const gas = mixOfChoice(mix.value)
  if (gas === null) return 'Enter the O2 and He of the mix in %.'
  const waterVolumeLitres = parseDecimal(size.value)
  if (waterVolumeLitres === null) return 'Enter the size in litres.'
  const initialPressureBar = pressure.value.trim() === '' ? 0 : parseDecimal(pressure.value)
  if (initialPressureBar === null) return 'Enter the pressure in bar.'
  const expectedResidualPressureBar = parseDecimal(residual.value)
  const opened = openedAt.value ? fromLocalInput(openedAt.value) : undefined
  const initialCostLines = costLinesOf(props.mixes ? [] : payments.value, opened)
  if (typeof initialCostLines === 'string') return initialCostLines
  return {
    label: label.value.trim(),
    mix: gas,
    waterVolumeLitres,
    initialPressureBar,
    lossPolicy: policy.value,
    ...(expectedResidualPressureBar !== null ? { expectedResidualPressureBar } : {}),
    ...(opened !== undefined ? { openedAt: opened } : {}),
    ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
    initialCostLines,
  }
}

async function submit() {
  const body = request()
  if (typeof body === 'string') {
    toast.error(body)
    return
  }
  saving.value = true
  try {
    const bank = await useVesselsApi().create(teamId.value, body)
    await router.replace({
      name: bankDetailRoute(bank),
      params: { teamId: teamId.value, vesselId: bank.vesselId },
    })
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    saving.value = false
  }
}
</script>
