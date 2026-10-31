import type { RouteLocationRaw } from 'vue-router'

// What a team tracks decides what exists for it; the team selector's choices.

export type TrackedArea = 'gas' | 'scrubber'

/** A page of an area the team switched off does not exist for it. */
export function isAreaOff(
  area: TrackedArea | undefined,
  gasEnabled: boolean,
  scrubberEnabled: boolean,
): boolean {
  if (area === 'gas') return !gasEnabled
  if (area === 'scrubber') return !scrubberEnabled
  return false
}

/** What may still hold value or be re-priced, in the words of what the team tracks. */
export function stockSentence(gasEnabled: boolean, scrubberEnabled: boolean): string | null {
  if (gasEnabled && scrubberEnabled) return 'Gas and scrubber still in stock are worth'
  if (gasEnabled) return 'Gas still in the banks is worth'
  if (scrubberEnabled) return 'Scrubber still in stock is worth'
  return null
}

export function stillInUseWords(gasEnabled: boolean, scrubberEnabled: boolean): string {
  if (gasEnabled && !scrubberEnabled) return 'banks'
  if (scrubberEnabled && !gasEnabled) return 'canisters'
  return 'banks and canisters'
}

export const ALL_TEAMS = 'ALL'
export const NEW_TEAM = 'NEW'

/** Where the header's selector leads: a team's home, the overview or the new-team form. */
export function teamChoiceRoute(choice: string): RouteLocationRaw {
  if (choice === ALL_TEAMS) return { name: 'TeamsOverview' }
  if (choice === NEW_TEAM) return { name: 'TeamCreate' }
  return { name: 'TeamHome', params: { teamId: choice } }
}
