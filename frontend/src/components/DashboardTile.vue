<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  to: RouteLocationRaw
  label: string
  count: number
  status: 'draft' | 'in-review' | 'submitted' | 'approved'
}>()

const borderColor = computed(() => {
  const map: Record<string, string> = {
    draft: 'var(--status-draft-fg)',
    'in-review': 'var(--status-in-review-fg)',
    submitted: 'var(--status-submitted-fg)',
    approved: 'var(--status-approved-fg)',
  }
  return map[props.status]
})
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
