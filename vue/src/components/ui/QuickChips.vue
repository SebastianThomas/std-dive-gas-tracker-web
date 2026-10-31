<template>
  <div class="flex flex-wrap gap-2" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.label"
      type="button"
      class="min-h-11 min-w-16 rounded-full border px-3 text-base font-medium"
      :class="
        model === option.value
          ? 'border-sky-600 bg-sky-600 text-white'
          : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
      "
      :aria-pressed="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
// Quick picks for a number field: a cylinder's size, a scoop of absorbent.
export interface QuickChip {
  label: string
  value: string
}

defineProps<{ options: readonly QuickChip[]; label: string }>()
const model = defineModel<string>({ required: true })
</script>
