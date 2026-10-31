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
        <span v-if="!teams.length">Gas Tracker</span>
      </RouterLink>
      <select
        v-if="teams.length"
        :value="current"
        aria-label="Team"
        class="min-h-11 min-w-0 flex-1 truncate rounded-lg border border-slate-300 bg-white px-2 py-2 text-base font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        @change="choose"
      >
        <option v-for="team in teams" :key="team.teamId" :value="String(team.teamId)">
          {{ team.name }}
        </option>
        <option v-if="teams.length > 1" :value="ALL_TEAMS">All teams</option>
        <option :value="NEW_TEAM">New team…</option>
      </select>
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
import { ALL_TEAMS, NEW_TEAM, teamChoiceRoute } from '@/lib/utils/teams'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'
import { useThemeStore } from '@/stores/theme'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const emit = defineEmits<{ logout: [] }>()
const auth = useAuthStore()
const theme = useThemeStore()
const session = useSessionStore()
const route = useRoute()
const router = useRouter()

// The team in the URL; the selector never holds state of its own.
const teams = computed(() => (auth.isLoggedIn ? (session.me?.teams ?? []) : []))
const current = computed(() => {
  if (route.name === 'TeamsOverview') return ALL_TEAMS
  if (route.name === 'TeamCreate') return NEW_TEAM
  return String(route.params.teamId ?? '')
})

// Every page gets the selector, also one opened directly; a failed load just leaves it out.
watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) session.ensureLoaded().catch(() => undefined)
  },
  { immediate: true },
)

function choose(event: Event) {
  void router.push(teamChoiceRoute((event.target as HTMLSelectElement).value))
}
</script>
