import { safeLocalStorage } from '@/lib/utils/safeLocalStorage'

// An invite opened while logged out waits here until the next login, on this device: creating an
// account leaves the app and may end in another tab.
const KEY = 'gas-pending-invite'

export const rememberInvite = (token: string): void => safeLocalStorage.setItem(KEY, token)
export const pendingInvite = (): string | null => safeLocalStorage.getItem(KEY)
export const forgetInvite = (): void => safeLocalStorage.removeItem(KEY)
