<template>
  <PageShell :title="team.team?.name ?? 'Team'">
    <template #actions>
      <AppButton v-if="team.gasEnabled" variant="link" :to="{ name: 'Reports', params: { teamId } }"
        >Reports</AppButton
      >
    </template>

    <AppCard title="Members">
      <ul class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
        <MemberRow v-for="member in current" :key="member.memberId" :member="member" />
      </ul>
      <p v-if="former.length" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Former members: {{ former.map((member) => member.displayName).join(', ') }}
      </p>

      <form
        v-if="team.isAdmin"
        class="mt-4 flex flex-col gap-3"
        novalidate
        @submit.prevent="addMember"
      >
        <h3 class="font-medium text-slate-800 dark:text-slate-200">Add a member</h3>
        <TextField
          id="member-username"
          v-model="username"
          autocomplete="off"
          label="Their STD Dive Log username"
          hint="They must have used this app once. New here? Send them the invite link."
        />
        <SelectField id="member-role" v-model="role" label="Role" class="max-w-56">
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </SelectField>
        <AppButton type="submit" variant="secondary" :loading="adding">Add member</AppButton>
      </form>

      <InviteLinkCard
        v-if="team.isAdmin"
        :key="teamId"
        :team-id="teamId"
        :team-name="team.team?.name ?? ''"
      />
    </AppCard>

    <AppCard title="Settings">
      <TeamSettingsForm
        v-if="team.isAdmin && team.team"
        :key="team.team.teamId"
        :team="team.team"
      />
      <dl
        v-else-if="team.team"
        class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300"
      >
        <template v-if="team.gasEnabled">
          <dt>Losses (new banks)</dt>
          <dd class="text-right">{{ lossPolicyLabel(team.team.defaultLossPolicy) }}</dd>
        </template>
        <dt>Currency</dt>
        <dd class="text-right">{{ team.team.currency }}</dd>
      </dl>
    </AppCard>

    <AppCard title="You">
      <form class="flex flex-wrap items-end gap-3" novalidate @submit.prevent="rename">
        <TextField
          id="me-name"
          v-model="displayName"
          label="Your name in the team lists"
          class="min-w-0 flex-1"
        />
        <AppButton type="submit" variant="secondary" :loading="renaming">Save</AppButton>
      </form>
      <p v-if="session.me" class="mt-2 break-all text-sm text-slate-500 dark:text-slate-400">
        Signed in as {{ session.me.username ? `@${session.me.username}` : session.me.email }}
      </p>
    </AppCard>

    <AppCard title="Your teams">
      <ul class="flex flex-col">
        <li v-for="other in session.me?.teams ?? []" :key="other.teamId">
          <AppButton
            variant="ghost"
            class="w-full justify-between"
            :to="{ name: 'TeamHome', params: { teamId: other.teamId } }"
          >
            <span>{{ other.name }}</span>
            <span v-if="other.teamId === teamId">
              <i class="fa-solid fa-check" aria-hidden="true" /><span class="sr-only"
                >(current)</span
              >
            </span>
          </AppButton>
        </li>
      </ul>
      <div class="mt-3 flex flex-wrap items-start gap-2">
        <AppButton variant="secondary" :to="{ name: 'TeamCreate' }">Create a team</AppButton>
        <ConfirmAction
          v-model:open="confirmLeave"
          label="Leave this team"
          variant="ghost"
          message="Leave the team? Your balance stays visible to the others until it is settled."
          confirm-label="Leave team"
          :busy="leaving"
          @confirm="leave"
        />
      </div>
    </AppCard>
  </PageShell>
</template>

<script setup lang="ts">
import PageShell from '@/components/layout/PageShell.vue'
import InviteLinkCard from '@/components/team/InviteLinkCard.vue'
import MemberRow from '@/components/team/MemberRow.vue'
import TeamSettingsForm from '@/components/team/TeamSettingsForm.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import ConfirmAction from '@/components/ui/ConfirmAction.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useTeamRoute } from '@/composables/useTeamRoute'
import { useTeamsApi } from '@/lib/api/teams'
import type { Role } from '@/lib/api/types'
import { lossPolicyLabel } from '@/lib/format/words'
import { extractErrorDetail } from '@/lib/utils/apiErrors'
import { useSessionStore } from '@/stores/session'
import { useTeamStore } from '@/stores/team'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

// F3: members (admins add, promote, remove), team settings (admins), your name, your teams.
const router = useRouter()
const team = useTeamStore()
const session = useSessionStore()
const { teamId } = useTeamRoute()
const username = ref('')
const role = ref<Role>('MEMBER')
const adding = ref(false)
const displayName = ref(session.me?.displayName ?? '')
const renaming = ref(false)
const confirmLeave = ref(false)
const leaving = ref(false)

const current = computed(() =>
  team.members
    .filter((member) => member.status !== 'LEFT')
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName)),
)
const former = computed(() => team.members.filter((member) => member.status === 'LEFT'))

async function addMember() {
  adding.value = true
  try {
    await useTeamsApi().addMember(teamId.value, {
      username: username.value.trim(),
      role: role.value,
    })
    username.value = ''
    role.value = 'MEMBER'
    await team.reloadMembers()
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    adding.value = false
  }
}

async function rename() {
  renaming.value = true
  try {
    await session.rename(displayName.value.trim())
    await team.reloadMembers()
    toast.success('Name saved.')
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    renaming.value = false
  }
}

async function leave() {
  leaving.value = true
  try {
    await useTeamsApi().leave(teamId.value)
    team.clear()
    await session.load()
    await router.replace({ name: 'Start' })
  } catch (err) {
    toast.error(extractErrorDetail(err))
  } finally {
    leaving.value = false
  }
}
</script>
