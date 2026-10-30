<template>
  <main class="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">Log in</h1>
      <p class="mt-2 text-slate-600 dark:text-slate-400">Use your STD Dive Log account.</p>
    </header>

    <form
      class="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
      @submit.prevent="submitLogin"
    >
      <TextField
        id="login-email"
        v-model="email"
        label="Email"
        type="email"
        inputmode="email"
        autocomplete="username"
        required
      />
      <TextField
        id="login-password"
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        required
      />
      <AppButton type="submit" :loading="loggingIn">Log in</AppButton>
    </form>

    <form
      v-if="devLoginEnabled"
      data-testid="dev-login"
      class="flex flex-col gap-4 rounded-2xl border border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950"
      @submit.prevent="submitDevLogin"
    >
      <p class="text-sm text-amber-900 dark:text-amber-200">
        <strong>Development login</strong> - backend profile <code>dev-login</code>, any email, no
        password. Never available in production.
      </p>
      <TextField
        id="dev-login-email"
        v-model="devEmail"
        label="Email"
        type="email"
        inputmode="email"
        required
      />
      <AppButton type="submit" variant="secondary" :loading="loggingIn">Dev login</AppButton>
    </form>
  </main>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import TextField from '@/components/ui/TextField.vue'
import { isDevLoginEnabled } from '@/lib/globals/constants'
import { resolveAuthUrl } from '@/lib/globals/url/resolveUrl'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const devEmail = ref('demo-admin@example.test')
const loggingIn = ref(false)
const devLoginEnabled = isDevLoginEnabled()

function redirectAfterLogin() {
  const from = typeof route.query.from === 'string' ? route.query.from : '/'
  void router.replace(from.startsWith('/') ? from : '/')
}

async function submitLogin() {
  loggingIn.value = true
  try {
    // The dive logger issues the tokens; its refresh cookie keeps the session alive.
    const { data } = await axios.post<{ accessToken: string }>(
      resolveAuthUrl('/api/auth/login'),
      { email: email.value.trim(), password: password.value },
      { withCredentials: true },
    )
    auth.login(data.accessToken)
    redirectAfterLogin()
  } catch (err) {
    // Deliberately generic (no account enumeration), like the dive-logger login.
    const unreachable = axios.isAxiosError(err) && !err.response
    toast.error(
      unreachable
        ? 'The login server is not reachable. Please try again later.'
        : 'Could not log in, please check your email and password.',
    )
  } finally {
    loggingIn.value = false
  }
}

async function submitDevLogin() {
  loggingIn.value = true
  try {
    await auth.loginWithDevToken(devEmail.value.trim())
    redirectAfterLogin()
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    loggingIn.value = false
  }
}
</script>
