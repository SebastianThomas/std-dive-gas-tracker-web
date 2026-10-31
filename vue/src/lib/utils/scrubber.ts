import type { QuickChip } from '@/components/ui/QuickChips.vue'
import type { ScrubberCanister } from '@/lib/api/types'
import { parseDecimal } from '@/lib/format/number'

// Display rules and form mapping for canisters; every amount of money comes from the backend.

/** Nobody weighs a scoop: the usual amounts, 2.5 kg preselected. */
export const USUAL_SCOOP_KG = '2.5'
export const SCOOP_CHIPS: readonly QuickChip[] = [
  { label: '2 kg', value: '2' },
  { label: '2.5 kg', value: '2.5' },
  { label: '3 kg', value: '3' },
]
export const USUAL_CAPACITY_KG = '23'

export function formatKg(kg: number): string {
  return `${Number(kg.toFixed(1)).toLocaleString('en')} kg`
}

/** How full the level bar is, in % of the capacity, from what was recorded. */
export function remainingPercent(canister: ScrubberCanister): number {
  return Math.min(100, Math.max(0, (canister.remainingKg / canister.capacityKg) * 100))
}

/** The open canisters to scoop from: the one opened first is usually the one in use. */
export function openCanisters(canisters: ScrubberCanister[]): ScrubberCanister[] {
  return canisters
    .filter((canister) => canister.status === 'OPEN')
    .toSorted((a, b) => a.openedAt - b.openedAt)
}

/** A use for the backend, or the first thing to fix. */
export function scrubberUseOf(
  memberId: number,
  kgText: string,
): { memberId: number; kg: number } | string {
  const kg = parseDecimal(kgText)
  if (kg === null || kg <= 0) return 'Enter the amount in kg.'
  return { memberId, kg }
}
