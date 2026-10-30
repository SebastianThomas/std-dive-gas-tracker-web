<template>
  <RouterLink
    :to="{ name: 'FillDetail', params: { teamId, fillId: fill.fillId } }"
    class="flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
  >
    <span class="flex min-w-0 flex-col">
      <span class="truncate font-medium text-slate-900 dark:text-slate-100">
        {{ mixLabel(fill.endMix) }} · {{ formatBar(fill.endPressureBar) }} ·
        {{ fill.targetLabel }}
      </span>
      <span class="truncate text-sm text-slate-500 dark:text-slate-400">
        {{ formatDateTime(fill.filledAt)
        }}<template v-if="showMember && fill.chargedMember">
          · {{ fill.chargedMember.displayName }}</template
        >
      </span>
    </span>
    <span
      class="shrink-0 text-right font-medium"
      :class="
        fill.status === 'VOIDED'
          ? 'text-slate-400 line-through dark:text-slate-500'
          : 'text-slate-900 dark:text-slate-100'
      "
    >
      {{ formatMoney(fill.totalCharge, currency) }}
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import type { FillSummary } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format/dates'
import { mixLabel } from '@/lib/format/mix'
import { formatMoney } from '@/lib/format/money'
import { formatBar } from '@/lib/format/units'

// One fill in a list: mix, pressure, cylinder/bank, when (and for whom), charge.
defineProps<{ fill: FillSummary; teamId: number; currency: string; showMember?: boolean }>()
</script>
