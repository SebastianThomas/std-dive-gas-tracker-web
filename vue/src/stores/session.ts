import { useMeApi } from '@/lib/api/me'
import type { Me } from '@/lib/api/types'
import { safeLocalStorage } from '@/lib/utils/safeLocalStorage'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const lastTeamKey = (userId: number) => `gas-last-team-${userId}`

/** The signed-in user (`GET /v1/me`) and the team they used last on this device. */
export const useSessionStore = defineStore('session', () => {
  const me = ref<Me | null>(null)

  async function load(): Promise<Me> {
    const loaded = await useMeApi().getMe()
    me.value = loaded
    return loaded
  }

  async function ensureLoaded(): Promise<Me> {
    return me.value ?? (await load())
  }

  async function rename(displayName: string): Promise<void> {
    me.value = await useMeApi().updateMe(displayName)
  }

  function lastTeamId(): number | null {
    if (!me.value) return null
    const stored = Number(safeLocalStorage.getItem(lastTeamKey(me.value.userId)))
    return me.value.teams.some((team) => team.teamId === stored) ? stored : null
  }

  function rememberTeam(teamId: number): void {
    if (me.value) safeLocalStorage.setItem(lastTeamKey(me.value.userId), String(teamId))
  }

  function clear(): void {
    me.value = null
  }

  return { me, load, ensureLoaded, rename, lastTeamId, rememberTeam, clear }
})
