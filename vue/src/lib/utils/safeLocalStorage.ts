/**
 * Thin wrapper around `localStorage` that never throws and degrades to a no-op when it's
 * unavailable (SSR, private browsing, quota exceeded, disabled by the browser/user) - every
 * direct `localStorage` call in the app was re-implementing this same guard individually.
 */
export const safeLocalStorage = {
  getItem(key: string): string | null {
    if (typeof localStorage === 'undefined') return null
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(key, value)
    } catch {
      // Silently fail - e.g. private browsing mode or storage quota exceeded.
    }
  },
  removeItem(key: string): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch {
      // Silently fail.
    }
  },
}
