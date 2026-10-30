/** Reads `exp` (seconds) from a JWT without verifying it - only to drop stale stored tokens. */
export function jwtExpiryMillis(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const exp = (JSON.parse(json) as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

export function isJwtExpired(token: string, now = Date.now(), skewMillis = 30_000): boolean {
  const expiry = jwtExpiryMillis(token)
  return expiry === null || expiry - skewMillis <= now
}
