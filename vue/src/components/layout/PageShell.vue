<template>
  <main class="mx-auto flex w-full max-w-screen-md flex-col gap-4 px-4 py-4">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <AppButton v-if="back" :to="back" variant="ghost" class="-ml-2 px-3" aria-label="Back">
        <i class="fa-solid fa-arrow-left" aria-hidden="true" />
      </AppButton>
      <h1 class="min-w-0 break-words text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {{ title }}
      </h1>
      <div v-if="$slots.actions" class="ml-auto flex flex-wrap items-center gap-1">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </main>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import type { RouteLocationRaw } from 'vue-router'

// Every team page: optional back link, the page title, header actions, then the content.
defineProps<{ title: string; back?: RouteLocationRaw }>()
</script>
