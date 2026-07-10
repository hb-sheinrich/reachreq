<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import Button from 'primevue/button'

const { theme, toggleTheme } = useTheme()

const icon = computed(() => (theme.value === 'dark' ? 'pi pi-moon' : 'pi pi-sun'))
const label = computed(() => (theme.value === 'dark' ? 'Dunkles Design' : 'Helles Design'))
</script>

<template>
  <Button
    :icon="icon"
    :title="label"
    :aria-label="label"
    text
    rounded
    class="text-text-muted hover:text-accent hover:bg-surface-2 focus:text-accent focus:bg-surface-2"
    @click="toggleTheme"
  />
</template>
