import type { Mix, VesselSummary } from '@/lib/api/types'
import { AIR, mixLabel } from '@/lib/format/mix'
import { parseDecimal } from '@/lib/format/number'

// Display rules for bank levels (UI only; the pressures themselves come from the backend).

/** Below this estimated pressure a bank shows as low (Home "low banks", amber level bar). */
export const LOW_BANK_BAR = 50
/** Full scale of the level bar: banks are filled to 200–300 bar. */
const LEVEL_SCALE_BAR = 300

export function isLow(bank: VesselSummary): boolean {
  return bank.status === 'IN_SERVICE' && bank.estimatedPressureBar < LOW_BANK_BAR
}

/** Width of the level bar in % (0–100). */
export function levelPercent(pressureBar: number): number {
  return Math.min(100, Math.max(0, (pressureBar / LEVEL_SCALE_BAR) * 100))
}

/** The gas of a bank as picked in a form: the three usual ones, or O2/He percentages. */
export interface MixChoice {
  kind: 'OXYGEN' | 'HELIUM' | 'AIR' | 'OTHER'
  o2: string
  he: string
}

export function mixOfChoice(choice: MixChoice): Mix | null {
  switch (choice.kind) {
    case 'OXYGEN':
      return { o2: 1, he: 0 }
    case 'HELIUM':
      return { o2: 0, he: 1 }
    case 'AIR':
      return AIR
    case 'OTHER': {
      const o2 = parseDecimal(choice.o2)
      const he = choice.he.trim() === '' ? 0 : parseDecimal(choice.he)
      return o2 === null || he === null ? null : { o2: o2 / 100, he: he / 100 }
    }
    default: {
      const unknown: never = choice.kind
      return unknown
    }
  }
}

export function choiceOfMix(mix: Mix): MixChoice {
  const label = mixLabel(mix)
  if (label === 'O2') return { kind: 'OXYGEN', o2: '', he: '' }
  if (label === 'He') return { kind: 'HELIUM', o2: '', he: '' }
  if (label === 'Air') return { kind: 'AIR', o2: '', he: '' }
  const percent = (fraction: number) => String(Math.round(fraction * 1000) / 10)
  return { kind: 'OTHER', o2: percent(mix.o2), he: percent(mix.he) }
}
