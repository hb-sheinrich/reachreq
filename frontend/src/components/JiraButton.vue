<script setup lang="ts">
import Button from 'primevue/button'

const props = defineProps<{
  issueKey?: string
  issueUrl?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'create'): void
}>()
</script>

<template>
  <div>
    <Button
      v-if="!issueKey"
      :loading="loading"
      icon="pi pi-ticket"
      label="Jira-Ticket anlegen"
      severity="secondary"
      size="small"
      @click="emit('create')"
    />
    <a
      v-else
      :href="issueUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-field bg-surface-2 text-text text-sm hover:bg-border transition-colors focus:outline-none focus:ring-2 focus:ring-focus"
    >
      <i class="pi pi-ticket" />
      {{ issueKey }}
    </a>
  </div>
</template>
