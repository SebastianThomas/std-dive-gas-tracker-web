const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/** Instants arrive as epoch millis (API.md conventions). */
export function formatDateTime(epochMillis: number): string {
  return dateTime.format(epochMillis)
}

export function formatDate(epochMillis: number): string {
  return date.format(epochMillis)
}

/** Value for an <input type="datetime-local"> in local time. */
export function toLocalInput(epochMillis: number): string {
  const local = new Date(epochMillis - new Date(epochMillis).getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function fromLocalInput(value: string): number | undefined {
  const millis = new Date(value).getTime()
  return Number.isNaN(millis) ? undefined : millis
}
