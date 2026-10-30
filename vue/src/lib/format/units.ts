// Physical values arrive unrounded (DOMAIN §3); these only shape them for display.

const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/** "200 bar"; one decimal below 10 bar, where it matters. */
export function formatBar(bar: number): string {
  return `${(Math.abs(bar) < 10 ? oneDecimal : whole).format(bar)} bar`
}

/** Gas amounts: "1,234 L". */
export function formatLitres(litres: number): string {
  return `${whole.format(litres)} L`
}

/** Cylinder or bank size: "12 L", "11.1 L". */
export function formatWaterVolume(litres: number): string {
  return `${oneDecimal.format(litres)} L`
}

export function formatPercent(fraction: number): string {
  return `${oneDecimal.format(fraction * 100)} %`
}
