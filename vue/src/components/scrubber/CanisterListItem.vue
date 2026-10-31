<template>
  <RouterLink
    :to="{ name: 'ScrubberDetail', params: { teamId, canisterId: canister.canisterId } }"
    class="flex min-h-14 flex-col gap-1.5 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
  >
    <span class="flex items-baseline justify-between gap-2">
      <span class="min-w-0 truncate font-medium text-slate-900 dark:text-slate-100">
        {{ canister.label }}
      </span>
      <span class="shrink-0 font-medium text-slate-900 dark:text-slate-100">
        <template v-if="canister.status === 'OPEN'"
          >≈ {{ formatKg(canister.remainingKg) }} left</template
        >
        <template v-else>Empty</template>
      </span>
    </span>
    <div
      v-if="canister.status === 'OPEN'"
      class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      aria-hidden="true"
    >
      <div
        class="h-full rounded-full bg-sky-500"
        :style="{ width: `${remainingPercent(canister)}%` }"
      />
    </div>
    <span class="flex flex-wrap justify-between gap-x-3 text-sm text-slate-500 dark:text-slate-400">
      <span>{{ formatKg(canister.recordedKg) }} used</span>
      <span>
        {{ formatMoney(canister.pricePerKg, currency) }}/kg<template v-if="canister.isEstimate">
          (estimate)</template
        >
      </span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import type { ScrubberCanister } from '@/lib/api/types'
import { formatMoney } from '@/lib/format/money'
import { formatKg, remainingPercent } from '@/lib/utils/scrubber'

// One canister in a list: what is left, what was used, its price per kg.
defineProps<{ canister: ScrubberCanister; teamId: number; currency: string }>()
</script>
