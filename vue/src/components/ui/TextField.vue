<template>
  <div class="flex flex-col gap-1">
    <label :for="id" class="text-sm font-medium text-slate-700 dark:text-slate-300">
      {{ label }}
    </label>
    <div class="flex items-center gap-2">
      <input
        :id="id"
        v-model="model"
        :type="type"
        :inputmode="inputmode"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :required="required"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || hint ? `${id}-help` : undefined"
        class="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
      <span v-if="unit" class="shrink-0 text-sm text-slate-500 dark:text-slate-400">
        {{ unit }}
      </span>
    </div>
    <p
      v-if="error || hint"
      :id="`${id}-help`"
      class="text-sm"
      :class="error ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'"
    >
      {{ error ?? hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
// Labelled input with optional unit suffix ("bar", "L"), hint and error. text-base (16 px) on
// purpose: smaller inputs make iOS Safari zoom on focus. Numbers: inputmode="decimal".
withDefaults(
  defineProps<{
    id: string
    label: string
    type?: string
    inputmode?: 'text' | 'decimal' | 'numeric' | 'email'
    autocomplete?: string
    placeholder?: string
    unit?: string
    hint?: string
    error?: string
    required?: boolean
  }>(),
  { type: 'text', inputmode: 'text' },
)

const model = defineModel<string>({ required: true })
</script>
