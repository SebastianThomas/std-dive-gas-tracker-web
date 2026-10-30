import type { Mix } from '@/lib/api/types'

/** "Air", "O2", "He", "EAN32" or "21/35" (O2/He in %), the way divers write mixes. */
export function mixLabel(mix: Mix): string {
  const o2 = Math.round(mix.o2 * 100)
  const he = Math.round(mix.he * 100)
  if (mix.o2 >= 0.99) return 'O2'
  if (mix.he >= 0.99) return 'He'
  if (he === 0 && Math.abs(mix.o2 - 0.209) <= 0.005) return 'Air'
  if (he === 0) return `EAN${o2}`
  return `${o2}/${he}`
}

export const AIR: Mix = { o2: 0.209, he: 0 }
