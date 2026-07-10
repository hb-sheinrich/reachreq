<script setup lang="ts">
import Badge from 'primevue/badge'

defineProps<{
  status: 'idle' | 'saving' | 'saved' | 'error' | 'conflict'
  message: string
}>()

const severityMap: Record<string, 'info' | 'success' | 'danger' | 'warn'> = {
  idle: 'info',
  saving: 'info',
  saved: 'success',
  error: 'danger',
  conflict: 'warn',
}
</script>

<template>
  <Badge v-if="message || status !== 'idle'" :value="message || status" :severity="severityMap[status] || 'info'" />
</template>
