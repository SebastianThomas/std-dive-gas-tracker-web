import { describe, expect, it } from 'vitest'
import {
  ALL_TEAMS,
  NEW_TEAM,
  inviteUrl,
  isAreaOff,
  stillInUseWords,
  stockSentence,
  teamChoiceRoute,
} from '@/lib/utils/teams'

describe('what a team tracks', () => {
  it('turns off only the pages of the switched-off area', () => {
    expect(isAreaOff('gas', false, true)).toBe(true)
    expect(isAreaOff('scrubber', false, true)).toBe(false)
    expect(isAreaOff('scrubber', true, false)).toBe(true)
    expect(isAreaOff('gas', true, false)).toBe(false)
    expect(isAreaOff(undefined, false, false)).toBe(false)
  })

  it('only mentions what the team tracks', () => {
    expect(stockSentence(true, true)).toContain('Gas and scrubber')
    expect(stockSentence(true, false)).toBe('Gas still in the banks is worth')
    expect(stockSentence(false, true)).toBe('Scrubber still in stock is worth')
    expect(stockSentence(false, false)).toBeNull()
    expect(stillInUseWords(true, false)).toBe('banks')
    expect(stillInUseWords(false, true)).toBe('canisters')
    expect(stillInUseWords(true, true)).toBe('banks and canisters')
  })
})

describe('team selector', () => {
  it('builds an invite link on this app', () => {
    expect(inviteUrl('https://gas.example', 'abc_-1')).toBe('https://gas.example/join/abc_-1')
  })

  it('leads to a team, the overview or the new-team form', () => {
    expect(teamChoiceRoute('7')).toEqual({ name: 'TeamHome', params: { teamId: '7' } })
    expect(teamChoiceRoute(ALL_TEAMS)).toEqual({ name: 'TeamsOverview' })
    expect(teamChoiceRoute(NEW_TEAM)).toEqual({ name: 'TeamCreate' })
  })
})
