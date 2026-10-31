<template>
  <li class="flex flex-col gap-2 py-3">
    <div class="flex flex-wrap items-baseline justify-between gap-x-2">
      <span class="min-w-0 break-words font-medium text-slate-900 dark:text-slate-100">
        {{ member.displayName }}<template v-if="isMe"> (you)</template>
      </span>
      <span class="text-sm text-slate-500 dark:text-slate-400">
        {{ member.role === 'ADMIN' ? 'Admin' : 'Member'
        }}<template v-if="member.status === 'PENDING'"> · invited</template>
      </span>
    </div>
    <span v-if="member.username" class="break-all text-sm text-slate-500 dark:text-slate-400"
      >@{{ member.username }}</span
    >
    <div v-if="team.isAdmin && !isMe" class="flex flex-wrap gap-2">
      <AppButton
        variant="ghost"
        :loading="busy"
        @click="setRole(member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN')"
      >
        {{ member.role === 'ADMIN' ? 'Make member' : 'Make admin' }}
      </AppButton>
      <ConfirmAction
        v-model:open="confirmRemove"
        label="Remove"
        variant="ghost"
        :message="`Remove ${member.displayName} from the team? Their balance stays until it is settled.`"
        confirm-label="Remove member"
        :busy="busy"
        @confirm="update({ status: 'LEFT' })"
      />
    </div>
  </li>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import ConfirmAction from '@/components/ui/ConfirmAction.vue'
import { useTeamsApi } from '@/lib/api/teams'
import type { Member, Role, UpdateMemberRequest } from '@/lib/api/types'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useTeamStore } from '@/stores/team'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

// One member; admins can change the role or remove (set LEFT) everyone but themselves.
const props = defineProps<{ member: Member }>()
const team = useTeamStore()
const busy = ref(false)
const confirmRemove = ref(false)
const isMe = computed(() => props.member.memberId === team.myMemberId)

const setRole = (role: Role) => update({ role })

async function update(request: UpdateMemberRequest) {
  if (team.teamId === null) return
  busy.value = true
  try {
    await useTeamsApi().updateMember(team.teamId, props.member.memberId, request)
    confirmRemove.value = false
    await team.reloadMembers()
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    busy.value = false
  }
}
</script>
