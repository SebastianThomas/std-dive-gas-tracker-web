import { computed } from 'vue'
import { useRoute } from 'vue-router'

/** The team id of the current `/t/:teamId/...` route (the URL is the source of truth). */
export function useTeamRoute() {
  const route = useRoute()
  const teamId = computed(() => Number(route.params.teamId))
  return { teamId, route }
}
