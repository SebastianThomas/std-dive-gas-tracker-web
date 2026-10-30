<template>
  <div class="flex flex-col gap-1">
    <label :for="id" class="text-sm font-medium text-slate-700 dark:text-slate-300">{{
      label
    }}</label>
    <select
      :id="id"
      v-model="model"
      class="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <slot />
    </select>
    <p v-if="hint" class="text-sm text-slate-500 dark:text-slate-400">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
// Labelled native <select> (best on phones). Options go in the default slot.
defineProps<{ id: string; label: string; hint?: string }>()
const model = defineModel<T>({ required: true })
</script>
