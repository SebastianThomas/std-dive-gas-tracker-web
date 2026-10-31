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
        <ConfirmAction
          v-model:open="confirmNew"
          label="New link"
          message="The current link stops working for good. Anyone who has not joined yet needs the new one."
          confirm-label="Create new link"
          :busy="busy"
          @confirm="reset"
        />
        <ConfirmAction
          v-model:open="confirmOff"
          label="Turn off"
          variant="ghost"
          message="Nobody can join with this link until it is turned on again."
          confirm-label="Turn off link"
          :busy="busy"
          @confirm="turnOff"
        />
      </div>
    </template>
    <template v-else-if="canTurnBackOn">
      <p
        role="status"
        class="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200"
      >
        The link is off. Turning it on brings back the last link, so anyone who still has it can
        join again. If it may have reached the wrong people, create a new link instead.
      </p>
      <div class="flex flex-wrap gap-2">
        <AppButton :loading="busy" @click="turnOn">Turn on last link</AppButton>
        <AppButton variant="secondary" :loading="busy" @click="reset">Create new link</AppButton>
      </div>
    </template>
    <AppButton v-else-if="!loadError" variant="secondary" :loading="busy" @click="reset">
      Create invite link
    </AppButton>
  </section>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import ConfirmAction from '@/components/ui/ConfirmAction.vue'
import { useTeamsApi } from '@/lib/api/teams'
import type { InviteLink } from '@/lib/api/types'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { inviteUrl } from '@/lib/utils/teams'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

// Admin: the team's link, the way in for anyone without looking up a username.
const props = defineProps<{ teamId: number; teamName: string }>()
const token = ref<string | null>(null)
const canTurnBackOn = ref(false)
const confirmNew = ref(false)
const confirmOff = ref(false)
const busy = ref(false)
const loadError = ref<string | null>(null)
const link = computed(() => (token.value ? inviteUrl(window.location.origin, token.value) : null))

function show(invite: InviteLink) {
  token.value = invite.token ?? null
  canTurnBackOn.value = invite.canTurnBackOn
}

onMounted(async () => {
  try {
    show(await useTeamsApi().inviteLink(props.teamId))
  } catch (err) {
    loadError.value = extractErrorDetail(err)
  }
})

async function change(request: () => Promise<InviteLink>) {
  busy.value = true
  try {
    show(await request())
    confirmNew.value = false
    confirmOff.value = false
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busy.value = false
  }
}

const reset = () => change(() => useTeamsApi().resetInviteLink(props.teamId))
const turnOff = () => change(() => useTeamsApi().turnOffInviteLink(props.teamId))
const turnOn = () => change(() => useTeamsApi().turnOnInviteLink(props.teamId))

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
