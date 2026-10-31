<template>
  <AppCard title="Result">
    <div role="status" aria-live="polite" class="min-h-24">
      <p v-if="problem" class="text-slate-500 dark:text-slate-400">{{ problem }}</p>
      <p v-else-if="error" class="text-red-700 dark:text-red-400">{{ error }}</p>
      <div v-else-if="preview" class="flex flex-col gap-2" :class="{ 'opacity-60': previewing }">
        <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {{ formatMoney(preview.totalCharge, team.currency) }}
          </span>
          <span class="text-slate-700 dark:text-slate-300">
            <template v-if="bankDraw">{{ mixLabel(preview.endMix) }} from the bank</template>
            <template v-else>
              {{ mixLabel(preview.endMix) }} at {{ formatBar(preview.endPressureBar) }}
            </template>
          </span>
        </p>
        <p v-if="isEstimate" class="text-sm text-amber-700 dark:text-amber-400">
          Estimate: the final price is set when the bank is closed.
        </p>
        <ul class="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
          <li v-for="stage in preview.stages" :key="stage.index" class="flex justify-between gap-2">
            <span class="min-w-0">
              <template v-if="!bankDraw">{{ stage.index + 1 }}. </template
              >{{ stage.source.type === 'VESSEL' ? stage.source.label : 'Air' }}:
              {{ bankDraw ? '' : '+' }}{{ formatLitres(stage.addedLitres) }}
            </span>
            <span class="shrink-0">{{ formatMoney(stage.charge, team.currency) }}</span>
          </li>
        </ul>
        <ul v-if="preview.warnings.length" class="flex flex-col gap-1">
          <li
            v-for="warning in preview.warnings"
            :key="`${warning.code}-${warning.stageIndex}`"
            class="text-sm text-amber-700 dark:text-amber-400"
          >
            <i class="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true" />
            {{ warning.message }}
          </li>
        </ul>
      </div>
      <p v-else class="text-slate-500 dark:text-slate-400">
        <i class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />Calculating…
      </p>
    </div>
  </AppCard>
</template>

<script setup lang="ts">
import AppCard from '@/components/ui/AppCard.vue'
import type { FillPreview } from '@/lib/api/types'
import { mixLabel } from '@/lib/format/mix'
import { formatMoney } from '@/lib/format/money'
import { formatBar, formatLitres } from '@/lib/format/units'
import { useTeamStore } from '@/stores/team'

// What a fill would cost, from the backend's preview, for both fill forms.
defineProps<{
  /** The first thing to fix in the form, if any. */
  problem?: string
  preview: FillPreview | null
  error: string | null
  previewing: boolean
  isEstimate: boolean
  bankDraw?: boolean
}>()
const team = useTeamStore()
</script>
