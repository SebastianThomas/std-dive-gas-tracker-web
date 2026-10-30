import { describe, expect, it } from 'vitest'
import { resolveUrl } from '@/lib/globals/url/resolveUrl'

describe('resolveUrl', () => {
  it('joins base and path without duplicate slashes', () => {
    expect(resolveUrl('/v1/me', 'http://localhost:8090/')).toBe('http://localhost:8090/v1/me')
    expect(resolveUrl('v1//me', 'https://api.example.test')).toBe('https://api.example.test/v1/me')
  })

  it('leaves absolute URLs alone', () => {
    expect(resolveUrl('https://other.test/x', 'http://localhost:8090')).toBe('https://other.test/x')
  })
})
