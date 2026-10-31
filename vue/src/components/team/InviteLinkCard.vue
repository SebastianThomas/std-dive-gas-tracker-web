<template>
  <section class="mt-4 flex flex-col gap-3" aria-label="Invite link">
    <h3 class="font-medium text-slate-800 dark:text-slate-200">Invite link</h3>
    <p class="text-sm text-slate-500 dark:text-slate-400">
      Anyone with the link can join as a member. Send it in your group chat.
    </p>
    <p v-if="loadError" class="text-sm text-red-700 dark:text-red-400">{{ loadError }}</p>
    <template v-if="link">
      <input
        :value="link"
        readonly
        aria-label="Invite link"
        class="min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-base text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        @focus="($event.target as HTMLInputElement).select()"
      />
      <div class="flex flex-wrap gap-2">
        <AppButton @click="share">
          <i class="fa-solid fa-share-nodes" aria-hidden="true" />Share
        </AppButton>
        <AppButton variant="secondary" :loading="busy" @click="reset">New link</AppButton>
        <AppButton variant="ghost" :loading="busy" @click="turnOff">Turn off</AppButton>
      </div>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        A new link stops the old one from working.
      </p>
    </template>
    <AppButton v-else-if="!loadError" variant="secondary" :loading="busy" @click="reset">
      Create invite link
    </AppButton>
  </section>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import { useTeamsApi } from '@/lib/api/teams'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { inviteUrl } from '@/lib/utils/teams'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

// Admin: the team's link, the way in for anyone without looking up a username.
const props = defineProps<{ teamId: number; teamName: string }>()
const token = ref<string | null>(null)
const busy = ref(false)
const loadError = ref<string | null>(null)
const link = computed(() => (token.value ? inviteUrl(window.location.origin, token.value) : null))

onMounted(async () => {
  try {
    token.value = (await useTeamsApi().inviteLink(props.teamId)).token ?? null
  } catch (err) {
    loadError.value = extractErrorDetail(err)
  }
})

async function reset() {
  busy.value = true
  try {
    token.value = (await useTeamsApi().resetInviteLink(props.teamId)).token ?? null
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busy.value = false
  }
}

async function turnOff() {
  busy.value = true
  try {
    await useTeamsApi().turnOffInviteLink(props.teamId)
    token.value = null
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busy.value = false
  }
}

/** The phone's share sheet where there is one, else the clipboard. */
async function share() {
  const url = link.value
  if (!url) return
  try {
    if (navigator.share) {
      await navigator.share({ title: `Join ${props.teamName}`, url })
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied.')
    }
  } catch (err) {
    // Closing the share sheet is not an error.
    if (err instanceof DOMException && err.name === 'AbortError') return
    toast.error('Could not share the link. Copy it from the field instead.')
  }
}
</script>
