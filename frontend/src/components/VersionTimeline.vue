<script setup lang="ts">
import { computed } from 'vue'
import Timeline from 'primevue/timeline'
import Button from 'primevue/button'
import type { RequirementVersion } from '@/stores/requirements'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  requirementId: string
  versions: RequirementVersion[]
}>()

const emit = defineEmits<{
  (e: 'restore', versionId: string): void
}>()

const auth = useAuthStore()

const events = computed(() => [...props.versions].sort((a, b) => b.versionNumber - a.versionNumber))

function formatDate(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '–'
  if (typeof value === 'string') return value || '–'
  if (Array.isArray(value)) {
    if (value.length === 0) return '–'
    if (value.every((v) => typeof v === 'string')) return value.join(', ')
    return `[${value.length} Einträge]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '–'
    return entries.map(([k, v]) => `${k}: ${formatValue(v)}`).join('; ')
  }
  return String(value)
}

function diffFields(diff?: Record<string, { from: unknown; to: unknown }> | null) {
  if (!diff) return []
  return Object.entries(diff)
}

function canRestore(version: RequirementVersion) {
  if (version.currentVersion) return false
  return auth.isAdmin || auth.user?.id === version.author?.id
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="!versions.length" class="text-sm text-text-muted">Keine Versionen vorhanden.</div>
    <Timeline v-else :value="events" layout="vertical" class="custom-timeline">
      <template #opposite="{ item }">
        <div class="text-xs text-text-muted">{{ formatDate(item.createdAt) }}</div>
      </template>
      <template #content="{ item }">
        <div class="bg-surface border border-border rounded-card p-3 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="font-display font-semibold text-text">Version {{ item.versionNumber }}</span>
              <span v-if="item.currentVersion" class="px-2 py-0.5 rounded-pill bg-accent text-accent-fg text-xs font-mono">
                Aktuell
              </span>
            </div>
            <Button
              v-if="canRestore(item)"
              icon="pi pi-undo"
              label="Wiederherstellen"
              size="small"
              text
              @click="emit('restore', item.id)"
            />
          </div>
          <div class="text-sm text-text-muted">
            {{ item.author?.name || 'Unbekannt' }} · {{ item.changeType || 'EDIT' }}
            <span v-if="item.status">· {{ item.status }}</span>
          </div>
          <div v-if="item.changeComment" class="text-sm text-text">{{ item.changeComment }}</div>
          <div v-if="diffFields(item.diff).length" class="space-y-1">
            <div class="text-label uppercase tracking-wide text-text-muted">Änderungen</div>
            <ul class="space-y-1">
              <li v-for="[field, change] in diffFields(item.diff)" :key="field" class="text-sm text-text-muted">
                <span class="font-mono text-text">{{ field }}:</span>
                <span class="line-through text-text-subtle">{{ formatValue(change.from) }}</span>
                <span class="mx-1">→</span>
                <span class="text-text">{{ formatValue(change.to) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </template>
      <template #marker="{ item }">
        <div
          class="w-3 h-3 rounded-full"
          :class="item.currentVersion ? 'bg-accent' : 'bg-border-strong'"
        />
      </template>
    </Timeline>
  </div>
</template>
