import { authUrl, backendUrl } from '../constants'

// Resolve a possibly-relative API path against a base URL while avoiding duplicate slashes (and
// preserving the protocol part like `https://`). Ported from the dive-logger frontend.
export function resolveUrl(path: string, baseUrl: string = backendUrl()): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path) || path.startsWith('//')) return path

  if (!baseUrl) {
    console.warn('Base URL is empty')
  }
  while (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1)
  }

  const joined =
    baseUrl === '' ? path : path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`

  const protocolIdx = joined.indexOf('://')
  if (protocolIdx >= 0) {
    const proto = joined.slice(0, protocolIdx + 3)
    const rest = joined.slice(protocolIdx + 3).replace(/\/\//g, '/')
    return proto + rest
  }
  return joined.replace(/\/\//g, '/')
}

/** Dive-logger ws: the token issuer (login / refresh / logout). */
export function resolveAuthUrl(path: string): string {
  return resolveUrl(path, authUrl())
}
