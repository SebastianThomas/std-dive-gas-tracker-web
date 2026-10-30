<template>
  <AppButton v-if="!open" :variant="variant" @click="open = true">{{ label }}</AppButton>
  <div
    v-else
    role="group"
    :aria-label="label"
    class="flex w-full flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/60"
  >
    <p class="text-slate-800 dark:text-slate-200">{{ message }}</p>
    <slot />
    <div class="flex flex-wrap gap-2">
      <AppButton variant="danger" :loading="busy" @click="emit('confirm')">
        {{ confirmLabel }}
      </AppButton>
      <AppButton variant="secondary" :disabled="busy" @click="open = false">Cancel</AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'

// The confirmation step of a destructive action (void fill, close bank, delete payment, remove
// member), inline instead of a dialog: nothing to position on a small screen. Extra inputs (a
// reason, a pressure) go in the default slot. Bind v-model:open to close it after success.
withDefaults(
  defineProps<{
    label: string
    message: string
    confirmLabel: string
    busy?: boolean
    variant?: 'danger' | 'secondary' | 'ghost'
  }>(),
  { variant: 'secondary' },
)
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { default: false })
</script>
