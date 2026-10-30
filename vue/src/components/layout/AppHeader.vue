<template>
  <header
    class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
    style="padding-top: env(safe-area-inset-top)"
  >
    <div class="mx-auto flex h-14 max-w-screen-md items-center gap-2 px-4">
      <RouterLink
        :to="{ name: 'Start' }"
        class="flex min-h-11 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"
      >
        <img src="/favicon.svg" alt="" class="h-6 w-6" />
        <span>Gas Tracker</span>
      </RouterLink>
      <div class="ml-auto flex items-center gap-1">
        <AppButton
          variant="ghost"
          :aria-label="theme.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="theme.toggleTheme()"
        >
          <i
            :class="theme.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"
            aria-hidden="true"
          />
        </AppButton>
        <AppButton
          v-if="auth.isLoggedIn"
          variant="ghost"
          aria-label="Log out"
          @click="emit('logout')"
        >
          <i class="fa-solid fa-right-from-bracket" aria-hidden="true" />
        </AppButton>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const emit = defineEmits<{ logout: [] }>()
const auth = useAuthStore()
const theme = useThemeStore()
</script>
