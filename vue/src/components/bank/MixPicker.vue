<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
      {{ legend }}
    </legend>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="option in options"
        :key="option.kind"
        type="button"
        class="min-h-11 min-w-16 rounded-full border px-3 text-base font-medium"
        :class="
          model.kind === option.kind
            ? 'border-sky-600 bg-sky-600 text-white'
            : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
        "
        :aria-pressed="model.kind === option.kind"
        @click="model = { ...model, kind: option.kind }"
      >
        {{ option.label }}
      </button>
    </div>
    <div v-if="model.kind === 'OTHER'" class="grid grid-cols-2 gap-3">
      <TextField
        :id="`${id}-o2`"
        :model-value="model.o2"
        label="O2"
        unit="%"
        inputmode="decimal"
        @update:model-value="model = { ...model, o2: $event }"
      />
      <TextField
        :id="`${id}-he`"
        :model-value="model.he"
        label="He"
        unit="%"
        inputmode="decimal"
        @update:model-value="model = { ...model, he: $event }"
      />
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import TextField from '@/components/ui/TextField.vue'
import type { MixChoice } from '@/lib/utils/banks'

// A bank's gas: O2, He, Air (an empty bank for blending nitrox) or a mix in percent.
withDefaults(defineProps<{ id: string; legend?: string }>(), { legend: 'Gas' })
const model = defineModel<MixChoice>({ required: true })

const options: { kind: MixChoice['kind']; label: string }[] = [
  { kind: 'OXYGEN', label: 'O2' },
  { kind: 'HELIUM', label: 'He' },
  { kind: 'AIR', label: 'Air' },
  { kind: 'OTHER', label: 'Mix' },
]
</script>
