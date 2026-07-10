<script setup lang="ts">
import { useLanguage } from '@/composables/useLanguage'

const { locale, setLocale } = useLanguage()

const options = [
  { label: 'DE', value: 'de' },
  { label: 'EN', value: 'en' },
] as const
</script>

<template>
  <div
    class="inline-flex items-center rounded-field border border-border bg-surface-2 p-1 gap-1"
    role="group"
    :aria-label="$t('app.language')"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="px-2 py-1 text-sm font-medium rounded-field transition-colors duration-dur ease focus:outline-none focus:ring-2 focus:ring-focus"
      :class="
        locale === opt.value
          ? 'bg-surface text-text shadow-sm'
          : 'text-text-muted hover:text-text hover:bg-surface'
      "
      :aria-pressed="locale === opt.value"
      @click="setLocale(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
