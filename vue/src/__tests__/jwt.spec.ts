import { describe, expect, it } from 'vitest'
import { isJwtExpired, jwtExpiryMillis } from '@/lib/utils/jwt'

const tokenWithExp = (exp: unknown) =>
  `x.${btoa(JSON.stringify({ sub: 'a@b.c', exp })).replace(/=+$/, '')}.sig`

describe('jwt helpers', () => {
  it('reads exp in milliseconds', () => {
    expect(jwtExpiryMillis(tokenWithExp(1_700_000_000))).toBe(1_700_000_000_000)
  })

  it('treats malformed tokens and tokens without exp as expired', () => {
    expect(jwtExpiryMillis('garbage')).toBeNull()
    expect(isJwtExpired(tokenWithExp('soon'))).toBe(true)
  })

  it('applies the clock skew', () => {
    const now = 1_000_000_000_000
    expect(isJwtExpired(tokenWithExp(now / 1000 + 60), now)).toBe(false)
    expect(isJwtExpired(tokenWithExp(now / 1000 + 10), now)).toBe(true)
  })
})
