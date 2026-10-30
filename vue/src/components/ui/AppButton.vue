<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    :class="variantClass"
  >
    <slot />
  </RouterLink>
  <button
    v-else
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
    :class="variantClass"
  >
    <i v-if="loading" class="fa-solid fa-spinner fa-spin" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

// Base button: 44 px min tap height (min-h-11) - use it instead of hand-styled <button>s.
// With `to` it renders a RouterLink that looks the same (navigation stays a link).
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link'
    type?: 'button' | 'submit'
    to?: RouteLocationRaw
    disabled?: boolean
    loading?: boolean
  }>(),
  { variant: 'primary', type: 'button', to: undefined },
)

const variantClass = computed(
  () =>
    ({
      primary: 'bg-sky-600 text-white hover:bg-sky-700',
      secondary:
        'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
      link: 'px-2 text-sky-700 hover:underline dark:text-sky-400',
    })[props.variant],
)
</script>
