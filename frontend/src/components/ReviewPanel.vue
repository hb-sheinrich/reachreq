<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import type { Requirement, RequirementReviewer } from '@/stores/requirements'
import type { User } from '@/stores/auth'
import { useCaseMessages } from '@/locales/useCase'

const props = defineProps<{
  requirement: Requirement
  user: User | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', payload: { reviewedByCe?: boolean; reviewedByAscShe?: boolean }): void
}>()

const { t } = useI18n({ messages: useCaseMessages })

const ASC_SHE_ALLOWED = [
  'asc@hup.de',
  'alexander.schulz@hup.de',
  'she@hup.de',
  'simon.heinrich@hup.de',
]

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
  if (reviewer?.name) parts.push(t('useCase.review.by', { name: reviewer.name }))
  if (date) parts.push(t('useCase.review.at', { date: formatDate(date) }))
  return parts.join(' · ')
}

const canSetAscShe = computed(() => {
  if (!props.user?.email) return false
  return ASC_SHE_ALLOWED.includes(props.user.email.toLowerCase())
})

const isDisabled = computed(() => props.disabled ?? false)

function onCeChange(value: boolean) {
  if (isDisabled.value) return
  emit('update', { reviewedByCe: value })
}

function onAscSheChange(value: boolean) {
  if (isDisabled.value) return
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
        :disabled="isDisabled"
        @update:model-value="onCeChange"
      />
      <label
        :for="'review-ce-' + requirement.id"
        class="text-sm text-text"
        :class="{ 'cursor-pointer': !isDisabled, 'cursor-not-allowed opacity-60': isDisabled }"
      >
        {{ t('useCase.review.ce') }}
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
        :disabled="isDisabled || !canSetAscShe"
        @update:model-value="onAscSheChange"
      />
      <div class="flex-1">
        <label
          :for="'review-asc-she-' + requirement.id"
          class="text-sm text-text"
          :class="{ 'cursor-pointer': !isDisabled && canSetAscShe, 'cursor-not-allowed opacity-60': isDisabled || !canSetAscShe }"
        >
          {{ t('useCase.review.ascShe') }}
        </label>
        <span
          v-if="!canSetAscShe"
          class="inline-flex items-center gap-1 ml-2 text-text-muted"
          :title="t('useCase.review.ascSheTooltip')"
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
