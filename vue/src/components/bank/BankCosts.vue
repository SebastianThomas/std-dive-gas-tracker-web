<template>
  <AppCard title="Costs">
    <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300">
      <dt>Paid for this bank</dt>
      <dd class="text-right font-medium">{{ money(bank.totalCost) }}</dd>
      <dt>Charged to fills so far</dt>
      <dd class="text-right">{{ money(bank.allocated) }}</dd>
      <dt>Not charged yet</dt>
      <dd class="text-right">{{ money(bank.unallocated) }}</dd>
    </dl>

    <ul
      v-if="bank.costLines.length"
      class="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800"
    >
      <li
        v-for="line in bank.costLines"
        :key="line.costLineId"
        class="flex items-center justify-between gap-2 py-2"
      >
        <span class="flex min-w-0 flex-col">
          <span class="text-slate-900 dark:text-slate-100">
            {{ money(line.amount) }} · {{ line.payer.displayName }}
          </span>
          <span class="truncate text-sm text-slate-500 dark:text-slate-400">
            {{ formatDate(line.paidAt) }}<template v-if="line.note"> · {{ line.note }}</template>
          </span>
        </span>
        <AppButton
          v-if="team.isAdmin"
          variant="ghost"
          :aria-label="`Delete cost ${money(line.amount)} by ${line.payer.displayName}`"
          :loading="deletingId === line.costLineId"
          @click="remove(line.costLineId)"
        >
          <i class="fa-solid fa-trash" aria-hidden="true" />
        </AppButton>
      </li>
    </ul>

    <form class="mt-4 flex flex-col gap-3" novalidate @submit.prevent="add">
      <h3 class="font-medium text-slate-800 dark:text-slate-200">Add a cost</h3>
      <div class="flex flex-wrap items-end gap-3">
        <TextField
          id="cost-amount"
          v-model="amount"
          label="Amount"
          :unit="team.currency"
          inputmode="decimal"
          class="w-40"
        />
        <SelectField
          v-if="team.isAdmin"
          id="cost-payer"
          v-model="payerId"
          label="Paid by"
          class="min-w-40 flex-1"
        >
          <option
            v-for="member in team.selectableMembers"
            :key="member.memberId"
            :value="member.memberId"
          >
            {{ member.displayName }}
          </option>
        </SelectField>
      </div>
      <TextField
        id="cost-note"
        v-model="note"
        label="Note (optional)"
        placeholder="e.g. refill, transport"
      />
      <AppButton type="submit" variant="secondary" :loading="adding">Add cost</AppButton>
    </form>
  </AppCard>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import type { VesselDetail } from '@/lib/api/types'
import { useVesselsApi } from '@/lib/api/vessels'
import { formatDate } from '@/lib/format/dates'
import { formatMoney } from '@/lib/format/money'
import { parseMoney } from '@/lib/format/number'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useTeamStore } from '@/stores/team'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

// A bank's money: what was paid for it, what fills carried so far, cost lines (a wrong one is
// deleted by an admin and re-added). Members add costs they paid themselves.
const props = defineProps<{ bank: VesselDetail; teamId: number }>()
const emit = defineEmits<{ changed: [bank: VesselDetail] }>()

const team = useTeamStore()
const amount = ref('')
const note = ref('')
const payerId = ref(team.myMemberId ?? 0)
const adding = ref(false)
const deletingId = ref<number | null>(null)
const money = (value: string) => formatMoney(value, team.currency)

async function add() {
  const parsed = parseMoney(amount.value)
  if (parsed === null) {
    toast.error('Enter the amount like 120.50.')
    return
  }
  adding.value = true
  try {
    emit(
      'changed',
      await useVesselsApi().addCostLine(props.teamId, props.bank.vesselId, {
        amount: parsed,
        payerMemberId: team.isAdmin ? payerId.value : (team.myMemberId ?? 0),
        ...(note.value.trim() ? { note: note.value.trim() } : {}),
      }),
    )
    amount.value = ''
    note.value = ''
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    adding.value = false
  }
}

async function remove(costLineId: number) {
  deletingId.value = costLineId
  try {
    emit(
      'changed',
      await useVesselsApi().deleteCostLine(props.teamId, props.bank.vesselId, costLineId),
    )
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    deletingId.value = null
  }
}
</script>
