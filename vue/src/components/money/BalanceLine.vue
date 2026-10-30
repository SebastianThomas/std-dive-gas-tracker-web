<template>
  <span :class="toneClass">{{ text }}</span>
</template>

<script setup lang="ts">
import { absoluteAmount, balanceTone, formatMoney } from '@/lib/format/money'
import { computed } from 'vue'

// "owes CHF 5.00" / "is owed CHF 5.00" / "settled" - the sign of a balance in words and colour.
const props = defineProps<{ balance: string; currency: string; you?: boolean }>()

const tone = computed(() => balanceTone(props.balance))
const text = computed(() => {
  const amount = formatMoney(absoluteAmount(props.balance), props.currency)
  switch (tone.value) {
    case 'owes':
      return props.you ? `You owe ${amount}` : `owes ${amount}`
    case 'owed':
      return props.you ? `You're owed ${amount}` : `is owed ${amount}`
    case 'settled':
      return props.you ? 'All settled' : 'settled'
    default: {
      const unknown: never = tone.value
      return unknown
    }
  }
})
const toneClass = computed(
  () =>
    ({
      owes: 'text-red-700 dark:text-red-400',
      owed: 'text-emerald-700 dark:text-emerald-400',
      settled: 'text-slate-500 dark:text-slate-400',
    })[tone.value],
)
</script>
