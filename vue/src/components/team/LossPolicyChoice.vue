<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
      How are gas losses shared?
    </legend>
    <label
      v-for="option in options"
      :key="option.value"
      class="flex min-h-11 cursor-pointer gap-3 rounded-xl border p-3"
      :class="
        model === option.value
          ? 'border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950'
          : 'border-slate-300 dark:border-slate-600'
      "
    >
      <input
        v-model="model"
        type="radio"
        :value="option.value"
        class="mt-1 h-5 w-5 accent-sky-600"
      />
      <span>
        <span class="block font-medium text-slate-900 dark:text-slate-100">{{ option.label }}</span>
        <span class="block text-sm text-slate-600 dark:text-slate-400">{{ option.help }}</span>
      </span>
    </label>
  </fieldset>
</template>

<script setup lang="ts">
import type { LossPolicy } from '@/lib/api/types'

// DOMAIN §7.3 in plain words; the enum names never reach the screen.
const model = defineModel<LossPolicy>({ required: true })

const options: { value: LossPolicy; label: string; help: string }[] = [
  {
    value: 'TRUE_UP',
    label: 'Exact per bank',
    help: 'Everyone who filled from a bank shares its full cost. Prices are estimates until the bank goes back to the supplier.',
  },
  {
    value: 'POOLED',
    label: 'Shared loss pool',
    help: 'Fills pay the list price of the gas. Gas left over when a bank goes back is shared equally by all members.',
  },
]
</script>
