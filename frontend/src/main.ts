import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import './style.css'
import { useAuthStore } from './stores/auth'

const ReachReqPreset = definePreset(Aura, {
  semantic: {
    colorScheme: {
      light: {
        primary: {
          color: 'var(--accent)',
          contrastColor: 'var(--accent-fg)',
          hoverColor: 'var(--accent-hover)',
          activeColor: 'var(--accent-hover)',
        },
        surface: {
          0: 'var(--surface)',
          50: 'var(--surface-2)',
          100: 'var(--surface-2)',
          200: 'var(--border)',
          300: 'var(--border-strong)',
          400: 'var(--text-subtle)',
          500: 'var(--text-muted)',
          600: 'var(--text-muted)',
          700: 'var(--text)',
          800: 'var(--text)',
          900: 'var(--text)',
          950: 'var(--text)',
        },
      },
      dark: {
        primary: {
          color: 'var(--accent)',
          contrastColor: 'var(--accent-fg)',
          hoverColor: 'var(--accent-hover)',
          activeColor: 'var(--accent-hover)',
        },
        surface: {
          0: 'var(--surface)',
          50: 'var(--surface-2)',
          100: 'var(--surface-2)',
          200: 'var(--border)',
          300: 'var(--border-strong)',
          400: 'var(--text-subtle)',
          500: 'var(--text-muted)',
          600: 'var(--text-muted)',
          700: 'var(--text)',
          800: 'var(--text)',
          900: 'var(--text)',
          950: 'var(--text)',
        },
      },
    },
  },
})

const app = createApp(App)

app.use(createPinia())
const auth = useAuthStore()

auth.fetchUser().then(() => {
  app.use(router)
  app.use(i18n)
  app.use(PrimeVue, {
    theme: {
      preset: ReachReqPreset,
      options: {
        darkModeSelector: 'html[data-theme="dark"]',
      },
    },
  })
  app.use(ToastService)
  app.use(ConfirmationService)

  app.mount('#app')
})
