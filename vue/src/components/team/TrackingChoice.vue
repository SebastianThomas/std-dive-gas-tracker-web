<template>
  <fieldset class="flex flex-col">
    <legend class="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
      What this team tracks
    </legend>
    <label class="flex min-h-11 items-center gap-3 text-slate-800 dark:text-slate-200">
      <input v-model="gas" type="checkbox" class="size-5 accent-sky-600" />
      Gas fills and banks
    </label>
    <label class="flex min-h-11 items-center gap-3 text-slate-800 dark:text-slate-200">
      <input v-model="scrubber" type="checkbox" class="size-5 accent-sky-600" />
      Scrubber
    </label>
    <p v-if="hint" class="text-sm text-slate-500 dark:text-slate-400">{{ hint }}</p>
  </fieldset>
</template>

<script setup lang="ts">
// The two independent tracking switches of a team (DOMAIN §2), when creating and in the settings.
defineProps<{ hint?: string }>()
const gas = defineModel<boolean>('gas', { required: true })
const scrubber = defineModel<boolean>('scrubber', { required: true })
</script>
