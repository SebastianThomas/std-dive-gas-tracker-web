import { useTeamsApi } from '@/lib/api/teams'
import type { Member, Team } from '@/lib/api/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * The team of the current `/t/:teamId` route and its members (pickers, names). The URL is the
 * source of the team id; this store only caches what belongs to it.
 */
export const useTeamStore = defineStore('team', () => {
  const team = ref<Team | null>(null)
  const members = ref<Member[]>([])

  const teamId = computed(() => team.value?.teamId ?? null)
  const isAdmin = computed(() => team.value?.role === 'ADMIN')
  const myMemberId = computed(() => team.value?.memberId ?? null)
  const currency = computed(() => team.value?.currency ?? 'CHF')
  const gasEnabled = computed(() => team.value?.gasTrackingEnabled ?? true)
  const scrubberEnabled = computed(() => team.value?.scrubberTrackingEnabled ?? true)
  /** Who can be charged for a fill or named on a cost line: everyone but LEFT members. */
  const selectableMembers = computed(() => members.value.filter((m) => m.status !== 'LEFT'))

  async function load(id: number): Promise<void> {
    const api = useTeamsApi()
    const [loadedTeam, loadedMembers] = await Promise.all([api.getTeam(id), api.members(id)])
    team.value = loadedTeam
    members.value = loadedMembers
  }

  async function reloadMembers(): Promise<void> {
    if (team.value) members.value = await useTeamsApi().members(team.value.teamId)
  }

  function memberName(memberId: number): string {
    return members.value.find((m) => m.memberId === memberId)?.displayName ?? '?'
  }

  function clear(): void {
    team.value = null
    members.value = []
  }

  return {
    team,
    members,
    teamId,
    isAdmin,
    myMemberId,
    currency,
    gasEnabled,
    scrubberEnabled,
    selectableMembers,
    load,
    reloadMembers,
    memberName,
    clear,
  }
})
