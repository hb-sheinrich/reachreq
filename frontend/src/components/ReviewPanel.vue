<script setup lang="ts">
import { computed } from 'vue'
import Checkbox from 'primevue/checkbox'
import type { Requirement, RequirementReviewer } from '@/stores/requirements'
import type { User } from '@/stores/auth'

const props = defineProps<{
  requirement: Requirement
  user: User | null
}>()

const emit = defineEmits<{
  (e: 'update', payload: { reviewedByCe?: boolean; reviewedByAscShe?: boolean }): void
}>()

const ASC_SHE_ALLOWED = ['alexander.schulz@hup.de', 'simon.heinrich@hup.de']

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

function reviewerText(reviewer?: RequirementReviewer | null, date?: string) {
  const parts = []
  if (reviewer?.name) parts.push(`von ${reviewer.name}`)
  if (date) parts.push(`am ${formatDate(date)}`)
  return parts.join(' · ')
}

const canSetAscShe = computed(() => {
  if (!props.user?.email) return false
  return ASC_SHE_ALLOWED.includes(props.user.email.toLowerCase())
})

function onCeChange(value: boolean) {
  emit('update', { reviewedByCe: value })
}

function onAscSheChange(value: boolean) {
  if (!canSetAscShe.value) return
  emit('update', { reviewedByAscShe: value })
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-start gap-3">
      <Checkbox
        :model-value="requirement.reviewedByCe"
        :input-id="'review-ce-' + requirement.id"
        binary
        @update:model-value="onCeChange"
      />
      <label :for="'review-ce-' + requirement.id" class="text-sm text-text cursor-pointer">
        Geprüft von CE
        <span v-if="requirement.reviewedByCe && requirement.reviewerCe" class="block text-xs text-text-muted">
          {{ reviewerText(requirement.reviewerCe, requirement.reviewedAtCe) }}
        </span>
      </label>
    </div>

    <div class="flex items-start gap-3">
      <Checkbox
        :model-value="requirement.reviewedByAscShe"
        :input-id="'review-asc-she-' + requirement.id"
        binary
        :disabled="!canSetAscShe"
        @update:model-value="onAscSheChange"
      />
      <div class="flex-1">
        <label
          :for="'review-asc-she-' + requirement.id"
          class="text-sm text-text"
          :class="{ 'cursor-pointer': canSetAscShe, 'cursor-not-allowed opacity-60': !canSetAscShe }"
        >
          Geprüft von ASC/SHE
        </label>
        <span
          v-if="!canSetAscShe"
          class="inline-flex items-center gap-1 ml-2 text-text-muted"
          title="Nur durch ASC/SHE änderbar"
        >
          <i class="pi pi-lock text-xs" />
        </span>
        <span v-if="requirement.reviewedByAscShe && requirement.reviewerAscShe" class="block text-xs text-text-muted">
          {{ reviewerText(requirement.reviewerAscShe, requirement.reviewedAtAscShe) }}
        </span>
      </div>
    </div>
  </div>
</template>
