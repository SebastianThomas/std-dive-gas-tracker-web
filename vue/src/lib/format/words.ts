import type { GasClass, LossPolicy } from '@/lib/api/types'

// Plain words for the backend's enums (AGENTS.md: never show enum names).

export function lossPolicyLabel(policy: LossPolicy): string {
  switch (policy) {
    case 'TRUE_UP':
      return 'Exact per bank'
    case 'POOLED':
      return 'Shared loss pool'
    default: {
      const unknown: never = policy
      return unknown
    }
  }
}

export function gasClassLabel(gasClass: GasClass): string {
  switch (gasClass) {
    case 'OXYGEN':
      return 'Oxygen'
    case 'HELIUM':
      return 'Helium'
    case 'AIR':
      return 'Air'
    case 'NITROX':
      return 'Nitrox'
    case 'TRIMIX':
      return 'Trimix'
    default: {
      const unknown: never = gasClass
      return unknown
    }
  }
}
