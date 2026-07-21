<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import { useLanguage } from '@/composables/useLanguage'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LanguageSwitch from '@/components/LanguageSwitch.vue'
import Button from 'primevue/button'
import Toast from 'primevue/toast'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const { syncFromUser } = useLanguage()

const { syncFromUser: syncThemeFromUser } = useTheme()

onMounted(() => {
  syncFromUser(auth.user?.locale)
  syncThemeFromUser(auth.user?.theme)
})

function logout() {
  auth.logout()
  router.push({ name: 'Login' })
}

const navItems = computed(() => [
  { label: t('app.dashboard'), name: 'Home' },
  { label: t('app.requirements'), name: 'Requirements' },
  { label: t('app.glossary'), name: 'Glossary' },
  { label: t('app.modules'), name: 'Modules' },
])

const activeName = computed(() => route.name)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-bg font-body">
    <Toast />
    <nav
      class="sticky top-0 z-50 h-14 flex items-center justify-between px-4 bg-surface border-b border-border"
    >
      <div class="flex items-center gap-6">
        <router-link
          :to="{ name: 'Home' }"
          class="font-display font-bold text-h1 text-text hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-focus rounded-field"
        >
          ReachReq
        </router-link>

        <div class="hidden sm:flex items-center gap-1" role="menubar">
          <router-link
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            class="relative px-3 py-2 text-sm font-medium rounded-field transition-colors duration-dur ease focus:outline-none focus:ring-2 focus:ring-focus"
            :class="
              activeName === item.name
                ? 'text-text'
                : 'text-text-muted hover:text-text hover:bg-surface-2'
            "
          >
            {{ item.label }}
            <span
              v-if="activeName === item.name"
              class="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 bg-accent rounded-full"
              aria-hidden="true"
            />
          </router-link>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <LanguageSwitch />
        <ThemeToggle />
        <span v-if="auth.user" class="hidden sm:inline text-sm text-text-muted">
          {{ auth.user.name }}
        </span>
        <Button
          v-if="auth.isAuthenticated"
          icon="pi pi-sign-out"
          text
          rounded
          :title="$t('app.logout')"
          :aria-label="$t('app.logout')"
          class="text-text-muted hover:text-accent hover:bg-surface-2 focus:text-accent focus:bg-surface-2"
          @click="logout"
        />
      </div>
    </nav>

    <main class="flex-1 p-4">
      <router-view />
    </main>
  </div>
</template>
