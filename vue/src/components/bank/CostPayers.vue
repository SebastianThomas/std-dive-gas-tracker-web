<template>
  <div class="flex flex-col gap-4">
    <div v-for="row in model" :key="row.key" class="flex flex-wrap items-end gap-3">
      <TextField
        :id="`cost-amount-${row.key}`"
        :model-value="row.amount"
        label="Amount paid"
        :unit="team.currency"
        inputmode="decimal"
        class="w-40"
        @update:model-value="update(row.key, { amount: $event })"
      />
      <SelectField
        v-if="team.isAdmin"
        :id="`cost-payer-${row.key}`"
        :model-value="row.payerId"
        label="Paid by"
        class="min-w-40 flex-1"
        @update:model-value="update(row.key, { payerId: $event })"
      >
        <option
          v-for="member in team.selectableMembers"
          :key="member.memberId"
          :value="member.memberId"
        >
          {{ member.displayName }}
        </option>
      </SelectField>
      <AppButton
        v-if="model.length > 1"
        type="button"
        variant="ghost"
        :aria-label="`Remove payer ${model.indexOf(row) + 1}`"
        @click="model = model.filter((other) => other.key !== row.key)"
      >
        <i class="fa-solid fa-trash" aria-hidden="true" />
      </AppButton>
    </div>
    <template v-if="team.isAdmin">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Shared? One line per person, with what each paid.
      </p>
      <AppButton type="button" variant="secondary" @click="addPayer">
        <i class="fa-solid fa-plus" aria-hidden="true" />Add another person
      </AppButton>
    </template>
    <p v-else class="text-sm text-slate-500 dark:text-slate-400">
      Paid by you. An admin can add what others paid.
    </p>
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import { newCostRow, type CostRow } from '@/lib/utils/banks'
import { useTeamStore } from '@/stores/team'

// Who paid for a new bank: one person for all of it, or one line per person (admins only, as
// members book costs they paid themselves).
const model = defineModel<CostRow[]>({ required: true })
const team = useTeamStore()

function update(key: number, change: Partial<CostRow>) {
  model.value = model.value.map((row) => (row.key === key ? { ...row, ...change } : row))
}

function addPayer() {
  const taken = new Set(model.value.map((row) => row.payerId))
  const next = team.selectableMembers.find((member) => !taken.has(member.memberId))
  model.value = [...model.value, newCostRow(next?.memberId ?? team.myMemberId ?? 0)]
}
</script>
