<template>
  <RouterLink
    :to="{ name: 'BankDetail', params: { teamId, vesselId: bank.vesselId } }"
    class="flex min-h-14 flex-col gap-1.5 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
  >
    <span class="flex items-baseline justify-between gap-2">
      <span class="min-w-0 truncate font-medium text-slate-900 dark:text-slate-100">
        {{ bank.label }}
        <span class="font-normal text-slate-500 dark:text-slate-400"
          >· {{ mixLabel(bank.mix) }}</span
        >
      </span>
      <span
        class="shrink-0 font-medium"
        :class="low ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'"
      >
        {{ formatBar(bank.estimatedPressureBar) }}
      </span>
    </span>
    <LevelBar
      v-if="bank.status === 'IN_SERVICE'"
      :pressure-bar="bank.estimatedPressureBar"
      :low="low"
    />
    <span class="flex flex-wrap justify-between gap-x-3 text-sm text-slate-500 dark:text-slate-400">
      <span v-if="bank.status === 'IN_SERVICE'"
        >{{ formatLitres(bank.usableContentLitres) }} usable</span
      >
      <span v-else-if="bank.closedAt">Closed {{ formatDate(bank.closedAt) }}</span>
      <span>
        {{ formatUnitPrice(bank.rate, currency)
        }}<template v-if="bank.rateIsEstimate"> (estimate)</template>
      </span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import LevelBar from '@/components/bank/LevelBar.vue'
import type { VesselSummary } from '@/lib/api/types'
import { formatDate } from '@/lib/format/dates'
import { mixLabel } from '@/lib/format/mix'
import { formatUnitPrice } from '@/lib/format/money'
import { formatBar, formatLitres } from '@/lib/format/units'
import { isLow } from '@/lib/utils/banks'
import { computed } from 'vue'

// One bank in a list: name, mix, pressure with level bar, usable gas, price per litre.
const props = defineProps<{ bank: VesselSummary; teamId: number; currency: string }>()
const low = computed(() => isLow(props.bank))
</script>
