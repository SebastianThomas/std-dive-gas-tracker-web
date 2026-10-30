<template>
  <p
    v-if="loading && !ready"
    class="py-8 text-center text-slate-500 dark:text-slate-400"
    role="status"
  >
    <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />Loading…
  </p>
  <div
    v-else-if="error && !ready"
    class="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-slate-900"
    role="alert"
  >
    <p class="text-slate-700 dark:text-slate-300">{{ error }}</p>
    <AppButton variant="secondary" @click="emit('retry')">Try again</AppButton>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'

// Loading → error with retry → content. `ready`: data is there (a reload keeps showing it).
defineProps<{ loading: boolean; error: string | null; ready: boolean }>()
const emit = defineEmits<{ retry: [] }>()
</script>
