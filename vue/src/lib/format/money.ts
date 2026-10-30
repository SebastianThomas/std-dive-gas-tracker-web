// Money arrives as a decimal string ("12.30", "-5.00"); it is only ever formatted here, never summed
// (AGENTS.md hard rule 4).

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string, digits: number, locale?: string): Intl.NumberFormat {
  const key = `${locale ?? ''}|${currency}|${digits}`
  let cached = formatters.get(key)
  if (!cached) {
    cached = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    formatters.set(key, cached)
  }
  return cached
}

/** "CHF 12.30" (locale-dependent layout). */
export function formatMoney(amount: string, currency: string, locale?: string): string {
  return formatter(currency, 2, locale).format(Number(amount))
}

/** A bank's price per litre, 4 decimals: "CHF 0.0537/L"; "—" for a closed bank without draws. */
export function formatUnitPrice(rate: string, currency: string, locale?: string): string {
  if (Number(rate) === 0) return '—'
  return `${formatter(currency, 4, locale).format(Number(rate))}/L`
}

export type BalanceTone = 'owed' | 'owes' | 'settled'

/** Positive: the team owes the member; negative: the member owes the team. */
export function balanceTone(balance: string): BalanceTone {
  const value = Number(balance)
  if (value > 0) return 'owed'
  if (value < 0) return 'owes'
  return 'settled'
}

/** The amount without its sign, for "you owe CHF 5.00" phrasing. */
export function absoluteAmount(amount: string): string {
  return amount.startsWith('-') ? amount.slice(1) : amount
}
