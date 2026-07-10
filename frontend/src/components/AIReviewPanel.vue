<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

interface Issue {
  field: string
  message: string
  suggestion?: string
}

interface ReviewResult {
  passed: boolean
  blockers: Issue[]
  warnings: Issue[]
  suggestions: Issue[]
}

const props = defineProps<{
  reviewFn: () => Promise<{ result: ReviewResult; status: string }>
  onIgnoreWarnings?: (reason: string) => void
}>()

const result = ref<ReviewResult | null>(null)
const loading = ref(false)
const ignoreReason = ref('')

onMounted(run)

async function run() {
  loading.value = true
  try {
    const review = await props.reviewFn()
    result.value = review.result
  } finally {
    loading.value = false
  }
}

function ignore() {
  if (props.onIgnoreWarnings && ignoreReason.value) {
    props.onIgnoreWarnings(ignoreReason.value)
  }
}
</script>

<template>
  <Card pt:root="bg-surface border border-border rounded-card shadow-sm">
    <template #title>
      <span class="font-display font-semibold text-h2">KI-Qualitätsprüfung</span>
    </template>
    <template #content>
      <div v-if="loading" class="text-sm text-text-muted">Prüfe...</div>
      <div v-else-if="result" class="space-y-4">
        <div v-if="result.blockers.length" class="text-text">
          <h4 class="font-display font-semibold text-glossary-alias mb-1">Blocker</h4>
          <ul class="list-disc pl-5 space-y-1">
            <li v-for="(b, i) in result.blockers" :key="`b-${i}`">
              <strong>{{ b.field }}:</strong> {{ b.message }}
              <span v-if="b.suggestion" class="text-sm text-text-muted">({{ b.suggestion }})</span>
            </li>
          </ul>
        </div>
        <div v-if="result.warnings.length" class="text-text">
          <h4 class="font-display font-semibold text-status-in-review-fg mb-1">Warnungen</h4>
          <ul class="list-disc pl-5 space-y-1">
            <li v-for="(w, i) in result.warnings" :key="`w-${i}`">
              <strong>{{ w.field }}:</strong> {{ w.message }}
            </li>
          </ul>
          <div class="flex gap-2 mt-2">
            <InputText v-model="ignoreReason" placeholder="Begründung für Ignorieren" class="flex-1" />
            <Button label="Ignorieren" size="small" @click="ignore" />
          </div>
        </div>
        <div v-if="result.suggestions.length" class="text-text">
          <h4 class="font-display font-semibold text-link mb-1">Vorschläge</h4>
          <ul class="list-disc pl-5 space-y-1">
            <li v-for="(s, i) in result.suggestions" :key="`s-${i}`">{{ s.message }}</li>
          </ul>
        </div>
        <div v-if="!result.blockers.length && !result.warnings.length && !result.suggestions.length" class="text-accent">
          Keine Hinweise gefunden.
        </div>
      </div>
      <Button v-if="!loading" label="Erneut prüfen" class="mt-2" size="small" @click="run" />
    </template>
  </Card>
</template>
