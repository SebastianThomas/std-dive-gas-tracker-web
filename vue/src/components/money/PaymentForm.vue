<template>
  <form class="flex flex-col gap-3" novalidate @submit.prevent="submit">
    <div class="grid gap-3 sm:grid-cols-2">
      <SelectField id="payment-from" v-model="draft.fromMemberId" label="From">
        <option v-for="member in members" :key="member.memberId" :value="member.memberId">
          {{ memberText(member) }}
        </option>
      </SelectField>
      <SelectField id="payment-to" v-model="draft.toMemberId" label="To">
        <option v-for="member in recipients" :key="member.memberId" :value="member.memberId">
          {{ memberText(member) }}
        </option>
      </SelectField>
    </div>
    <TextField
      id="payment-amount"
      v-model="draft.amount"
      label="Amount"
      :unit="currency"
      inputmode="decimal"
      class="max-w-56"
    />
    <TextField
      id="payment-note"
      v-model="draft.note"
      label="Note (optional)"
      placeholder="e.g. TWINT, cash"
    />
    <AppButton type="submit" :loading="saving">Record payment</AppButton>
  </form>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import type { Member, PaymentInput } from '@/lib/api/types'
import { parseMoney } from '@/lib/format/number'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

// Money handed over between two members (anyone of the team, also former members settling up).
// A suggestion fills it in through prefill(); after a saved payment the parent calls reset().
const props = defineProps<{
  members: Member[]
  currency: string
  myMemberId: number
  saving?: boolean
}>()
const emit = defineEmits<{ submit: [input: PaymentInput] }>()

const empty = () => ({
  fromMemberId: props.myMemberId,
  toMemberId: props.members.find((member) => member.memberId !== props.myMemberId)?.memberId ?? 0,
  amount: '',
  note: '',
})
const draft = ref(empty())

// Nobody pays themselves: the payer is no choice in "To", which moves on if it was the new payer.
const recipients = computed(() =>
  props.members.filter((member) => member.memberId !== draft.value.fromMemberId),
)
watch(
  () => draft.value.fromMemberId,
  (fromMemberId) => {
    if (draft.value.toMemberId === fromMemberId) {
      draft.value.toMemberId = recipients.value[0]?.memberId ?? 0
    }
  },
)

const memberText = (member: Member) =>
  member.status === 'LEFT' ? `${member.displayName} (left)` : member.displayName

function submit() {
  if (recipients.value.length === 0) {
    toast.error('There is nobody else in this team to pay yet.')
    return
  }
  const amount = parseMoney(draft.value.amount)
  if (amount === null) {
    toast.error('Enter the amount like 12.50.')
    return
  }
  const note = draft.value.note.trim()
  emit('submit', {
    fromMemberId: draft.value.fromMemberId,
    toMemberId: draft.value.toMemberId,
    amount,
    ...(note ? { note } : {}),
  })
}

defineExpose({
  prefill(fromMemberId: number, toMemberId: number, amount: string) {
    draft.value = { ...draft.value, fromMemberId, toMemberId, amount }
  },
  reset() {
    draft.value = empty()
  },
})
</script>
