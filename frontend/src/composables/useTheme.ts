import { ref, watch, type Ref } from 'vue'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'reachreq-theme'

const theme = ref<Theme>('light')

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    // ignore storage/matchMedia errors
  }
  return 'light'
}

function applyTheme(value: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', value)
    document.documentElement.style.backgroundColor = value === 'dark' ? '#0e1116' : '#f7f8fa'
  }
}

theme.value = getInitialTheme()
applyTheme(theme.value)

export function useTheme() {
  const auth = useAuthStore()

  function setTheme(value: Theme) {
    if (theme.value === value) return
    theme.value = value
    applyTheme(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // ignore
    }
    if (auth.user) {
      api.patch('/auth/me', { theme: value }).catch(() => {})
    }
  }

  function toggleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  return { theme: theme as Ref<Theme>, setTheme, toggleTheme }
}
