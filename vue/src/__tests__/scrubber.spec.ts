import { describe, expect, it } from 'vitest'
import type { ScrubberCanister } from '@/lib/api/types'
import { formatKg, openCanisters, remainingPercent, scrubberUseOf } from '@/lib/utils/scrubber'

const canister = (canisterId: number, status: string, openedAt: number, remainingKg = 23) =>
  ({ canisterId, status, openedAt, remainingKg, capacityKg: 23 }) as ScrubberCanister

describe('scrubber form and display', () => {
  it('turns the typed amount into a use, with either decimal separator', () => {
    expect(scrubberUseOf(7, '2,5')).toEqual({ memberId: 7, kg: 2.5 })
    expect(scrubberUseOf(7, '3')).toEqual({ memberId: 7, kg: 3 })
  })

  it('asks for an amount above zero', () => {
    expect(scrubberUseOf(7, '')).toBe('Enter the amount in kg.')
    expect(scrubberUseOf(7, '0')).toBe('Enter the amount in kg.')
  })

  it('offers open canisters only, the one opened first on top', () => {
    const ids = openCanisters([
      canister(1, 'OPEN', 300),
      canister(2, 'EMPTY', 100),
      canister(3, 'OPEN', 200),
    ]).map((found) => found.canisterId)
    expect(ids).toEqual([3, 1])
  })

  it('shows the level from what is left', () => {
    expect(remainingPercent(canister(1, 'OPEN', 1, 11.5))).toBe(50)
    expect(remainingPercent(canister(1, 'OPEN', 1, 0))).toBe(0)
  })

  it('writes kilograms briefly', () => {
    expect(formatKg(2.5)).toBe('2.5 kg')
    expect(formatKg(23)).toBe('23 kg')
    expect(formatKg(14.54)).toBe('14.5 kg')
  })
})
