<template>
  <nav
    aria-label="Main"
    class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <ul class="mx-auto grid max-w-screen-md grid-cols-5">
      <li v-for="tab in tabs" :key="tab.name">
        <RouterLink
          :to="{ name: tab.name, params: { teamId } }"
          class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium"
          :class="
            isActive(tab)
              ? 'text-sky-700 dark:text-sky-400'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          "
          :aria-current="isActive(tab) ? 'page' : undefined"
        >
          <i :class="['fa-solid text-lg', tab.icon]" aria-hidden="true" />
          {{ tab.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

// The five places of the app (docs/PLAN.md simplicity budget).
defineProps<{ teamId: number }>()

interface Tab {
  name: string
  label: string
  icon: string
  /** Child routes that also light this tab up. */
  also: string[]
}

const tabs: Tab[] = [
  { name: 'TeamHome', label: 'Home', icon: 'fa-house', also: [] },
  { name: 'FillRecord', label: 'Fill', icon: 'fa-circle-plus', also: ['FillList', 'FillDetail'] },
  { name: 'BankList', label: 'Banks', icon: 'fa-gauge-high', also: ['BankCreate', 'BankDetail'] },
  { name: 'Money', label: 'Money', icon: 'fa-coins', also: [] },
  { name: 'TeamSettings', label: 'Team', icon: 'fa-users', also: ['Reports'] },
]

const route = useRoute()
const isActive = (tab: Tab) =>
  route.name === tab.name || tab.also.includes(String(route.name ?? ''))
</script>
