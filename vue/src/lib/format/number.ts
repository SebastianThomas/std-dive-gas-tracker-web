/** User input to a number: accepts "12.5" and "12,5", trims; empty or invalid gives null. */
export function parseDecimal(input: string): number | null {
  const normalised = input.trim().replace(',', '.')
  if (normalised === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(normalised)) return null
  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

/** User input to a money string for the API ("12,5" → "12.50"); null when not a valid amount. */
export function parseMoney(input: string): string | null {
  const value = parseDecimal(input)
  if (value === null || value <= 0) return null
  const normalised = input.trim().replace(',', '.')
  const decimals = normalised.includes('.') ? normalised.split('.')[1]!.length : 0
  return decimals > 2 ? null : value.toFixed(2)
}
