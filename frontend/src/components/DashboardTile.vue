<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  to: RouteLocationRaw
  label: string
  count: number
  status: string
}>()

const borderColor = computed(() => {
  const token = statusToken(props.status)
  return `var(--status-${token}-fg)`
})

function statusToken(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'draft',
    IN_REVIEW: 'in-review',
    SUBMITTED_FOR_RELEASE: 'submitted',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    POSTPONED: 'postponed',
    IMPORTED: 'imported',
    ARCHIVED: 'archived',
  }
  return map[status] || status.toLowerCase().replace(/_/g, '-')
}
</script>

<template>
  <router-link
    :to="to"
    class="group block rounded-card bg-surface border border-border p-4 transition-all duration-dur ease hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus:outline-none focus:ring-2 focus:ring-focus"
    :style="{ borderLeftWidth: '3px', borderLeftColor: borderColor }"
  >
    <div class="text-label uppercase tracking-wide text-text-muted mb-1">
      {{ label }}
    </div>
    <div class="text-id font-display font-bold text-text">
      {{ count }}
    </div>
  </router-link>
</template>
