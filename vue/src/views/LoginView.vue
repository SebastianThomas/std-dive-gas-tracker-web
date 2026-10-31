<template>
  <main class="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">Log in</h1>
      <p class="mt-2 text-slate-600 dark:text-slate-400">Use your STD Dive Log account.</p>
    </header>

    <LoginForm>
      <p v-if="signup" class="text-center text-slate-600 dark:text-slate-400">
        No account yet?
        <a
          :href="signup"
          data-testid="signup-link"
          class="inline-flex min-h-11 items-center font-medium text-sky-700 underline dark:text-sky-400"
          >Create one</a
        >
      </p>
    </LoginForm>
  </main>
</template>

<script setup lang="ts">
import LoginForm from '@/components/auth/LoginForm.vue'
import { signupUrl } from '@/lib/globals/constants'
import { useAuthStore } from '@/stores/auth'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// Back to this very page afterwards, with the invite it may be on the way to.
const signup = signupUrl()
  ? `${signupUrl()}?returnTo=${encodeURIComponent(location.origin + route.fullPath)}`
  : ''

// A login rebuilds this page (App keys its view on the session), so it reacts to being logged in.
watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (!loggedIn) return
    const from = typeof route.query.from === 'string' ? route.query.from : '/'
    void router.replace(from.startsWith('/') ? from : '/')
  },
  { immediate: true },
)
</script>
