<template>
  <section
    class="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
    :aria-labelledby="title ? headingId : undefined"
  >
    <header v-if="title || $slots.actions" class="mb-3 flex items-center justify-between gap-2">
      <h2
        v-if="title"
        :id="headingId"
        class="text-lg font-semibold text-slate-900 dark:text-slate-100"
      >
        {{ title }}
      </h2>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue'

// The one card style of the app: white/dark surface, rounded, optional title + header actions.
defineProps<{ title?: string }>()
const headingId = useId()
</script>
