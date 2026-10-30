<template>
  <div
    class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
    role="img"
    :aria-label="`Level ${formatBar(pressureBar)}`"
  >
    <div
      class="h-full rounded-full"
      :class="low ? 'bg-amber-500' : 'bg-sky-500'"
      :style="{ width: `${levelPercent(pressureBar)}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { formatBar } from '@/lib/format/units'
import { levelPercent } from '@/lib/utils/banks'

// A bank's estimated pressure at a glance (300 bar full scale), amber when low.
defineProps<{ pressureBar: number; low?: boolean }>()
</script>
