<template>
  <Toaster position="top-center" rich-colors close-button />
  <div class="flex min-h-dvh flex-col">
    <AppHeader @logout="handleLogout" />
    <div
      v-if="auth.status === 'unreachable'"
      role="status"
      class="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-100"
    >
      The login server is not reachable.
      <button class="ml-2 min-h-11 font-semibold underline" @click="auth.tryInitialLogin()">
        Retry
      </button>
    </div>
    <RouterView :key="auth.sessionVersion" class="flex-1" />
  </div>
</template>

<script setup lang="ts">
import 'vue-sonner/style.css'

import AppHeader from '@/components/layout/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Toaster } from 'vue-sonner'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

// A session that ends while a page is open (token rejected, refresh refused) goes to the login.
watch(
  () => auth.isLoggedIn,
  (loggedIn, wasLoggedIn) => {
    if (wasLoggedIn && !loggedIn && route.matched.some((r) => r.meta.requiresAuth)) {
      void router.replace({ name: 'Login', query: { from: route.fullPath } })
    }
  },
)

async function handleLogout() {
  await auth.logout()
  await router.replace({ name: 'Login' })
}
</script>
