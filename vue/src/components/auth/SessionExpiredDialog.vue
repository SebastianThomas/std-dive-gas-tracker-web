<template>
  <div
    ref="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="session-expired-title"
    tabindex="-1"
    class="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950"
  >
    <main class="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <header class="text-center">
        <h1
          id="session-expired-title"
          class="text-2xl font-bold text-slate-900 dark:text-slate-100"
        >
          Please log in again
        </h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Your session has ended. Nothing is lost: what you were doing continues after the login.
        </p>
      </header>
      <LoginForm />
      <AppButton variant="ghost" @click="emit('logout')">Log out instead</AppButton>
    </main>
  </div>
</template>

<script setup lang="ts">
import LoginForm from '@/components/auth/LoginForm.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { onMounted, useTemplateRef } from 'vue'

// Covers the page instead of leaving it, so its form and its waiting operation stay as they are.
const emit = defineEmits<{ logout: [] }>()
const dialog = useTemplateRef<HTMLElement>('dialog')
onMounted(() => dialog.value?.focus())
</script>
