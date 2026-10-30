import { defineStore } from 'pinia'
import { ref } from 'vue'
import { safeLocalStorage } from '@/lib/utils/safeLocalStorage'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme-preference'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>('light')

  const initializeTheme = () => {
    const hasWindow = typeof window !== 'undefined'
    const storedTheme = safeLocalStorage.getItem(THEME_STORAGE_KEY) as Theme | null

    if (storedTheme) {
      theme.value = storedTheme
    } else if (hasWindow && typeof window.matchMedia === 'function') {
      // Auto-detect system preference on first visit when available
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme.value = prefersDark ? 'dark' : 'light'
    }

    applyTheme()
  }

  const applyTheme = () => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme.value)
    }
    safeLocalStorage.setItem(THEME_STORAGE_KEY, theme.value)
  }

  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyTheme()
  }

  return {
    theme,
    initializeTheme,
    toggleTheme,
  }
})
