import { computed } from 'vue'
import { i18n, initLocale, setI18nLocale, type SupportedLocale } from '@/i18n'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

export function useLanguage() {
  const auth = useAuthStore()

  const locale = computed({
    get: () => (i18n.global.locale.value as SupportedLocale) || 'de',
    set: (value: SupportedLocale) => {
      if (!value) return
      setLocale(value)
    },
  })

  function setLocale(value: SupportedLocale) {
    if (i18n.global.locale.value === value) return
    setI18nLocale(value)
    if (auth.user) {
      api.patch('/auth/me', { locale: value }).catch(() => {})
    }
  }

  function syncFromUser(userLocale?: string | null) {
    initLocale(userLocale)
  }

  return { locale, setLocale, syncFromUser }
}
