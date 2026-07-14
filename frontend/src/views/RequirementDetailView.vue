<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter, onBeforeRouteUpdate, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useRequirementsStore } from '@/stores/requirements'
import { useModulesStore } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useGlossaryStore } from '@/stores/glossary'
import { useAutosave } from '@/services/autosave'
import { api } from '@/services/api'
import { useTitle } from '@/composables/useTitle'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import TabPanel from 'primevue/tabpanel'
import TabView from 'primevue/tabview'
import Dialog from 'primevue/dialog'
import TiptapEditor from '@/components/TiptapEditor.vue'
import TagInput from '@/components/TagInput.vue'
import ReviewPanel from '@/components/ReviewPanel.vue'
import JiraButton from '@/components/JiraButton.vue'
import VersionTimeline from '@/components/VersionTimeline.vue'
import AIReviewPanel from '@/components/AIReviewPanel.vue'
import CommentList from '@/components/CommentList.vue'
import AutosaveIndicator from '@/components/AutosaveIndicator.vue'
import { classificationClass } from '@/utils/classification'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const store = useRequirementsStore()
const modulesStore = useModulesStore()
const auth = useAuthStore()
const glossary = useGlossaryStore()

const id = computed(() => route.params.id as string)
const draft = ref<any>({})
const ready = ref(false)
const activeTab = ref(0)
const showReject = ref(false)
const rejectReason = ref('')
const editMode = ref(false)
const reviewTrigger = ref(0)
const showSubmitGate = ref(false)
const gateReview = ref<{ id: string; result: any } | null>(null)
const gateIgnoreReason = ref('')
const gateSubmitting = ref(false)
const appendixEntries = ref<{ key: string; value: string }[]>([])
const jiraLoading = ref(false)
const pendingAnchor = ref<{ field: string; text: string; start: number; end: number } | null>(null)
const viewLanguage = ref<'de' | 'en'>('de')
const translating = ref(false)

useTitle(computed(() => store.current?.humanReadableId || ''))

const classificationOptions = [
  { label: t('classification.MUST_HAVE'), value: 'MUST_HAVE' },
  { label: t('classification.SHOULD_HAVE'), value: 'SHOULD_HAVE' },
  { label: t('classification.NICE_TO_HAVE'), value: 'NICE_TO_HAVE' },
  { label: t('classification.WONT_HAVE'), value: 'WONT_HAVE' },
  { label: t('classification.IMPORTED'), value: 'IMPORTED' },
]

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-status-draft-bg text-status-draft-fg',
  IN_REVIEW: 'bg-status-in-review-bg text-status-in-review-fg',
  SUBMITTED_FOR_RELEASE: 'bg-status-submitted-bg text-status-submitted-fg',
  APPROVED: 'bg-status-approved-bg text-status-approved-fg',
  REJECTED: 'bg-status-rejected-bg text-status-rejected-fg',
  POSTPONED: 'bg-status-postponed-bg text-status-postponed-fg',
  IMPORTED: 'bg-status-imported-bg text-status-imported-fg',
  ARCHIVED: 'bg-status-archived-bg text-status-archived-fg',
}

function statusClass(status: string) {
  return statusClasses[status] || 'bg-surface-2 text-text-muted'
}

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

const isTranslation = computed(() => store.current !== null && viewLanguage.value !== store.current?.originalLanguage)

const isEditable = computed(() => {
  return (store.current?.status === 'DRAFT' || store.current?.status === 'IN_REVIEW' || store.current?.status === 'IMPORTED') && !isTranslation.value
})

const canTranslate = computed(() => store.current !== null && viewLanguage.value !== store.current?.originalLanguage && !store.current?.hasTranslation && !translating.value)

const languageOptions = computed(() => [
  { label: 'DE', value: 'de' },
  { label: 'EN', value: 'en' },
])

async function loadWithLanguage(lang: 'de' | 'en' = viewLanguage.value) {
  await store.fetchRequirement(id.value, lang)
  initDraft()
}

watch(isEditable, (editable) => {
  if (!editable) editMode.value = false
})

watch(viewLanguage, async () => {
  await loadWithLanguage()
})

function cloneDeep<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function initDraft() {
  if (!store.current) return
  ready.value = false
  const source = store.current
  draft.value = {
    title: source.title,
    goal: source.goal,
    precondition: source.precondition,
    postcondition: source.postcondition,
    mainFlow: cloneDeep(source.mainFlow || []),
    alternativeFlows: (source.alternativeFlows || []).map((flow: any) => ({
      id: flow.id,
      title: flow.title || '',
      afterStep: flow.afterStep ?? flow.branchAt ?? '',
      steps: cloneDeep(flow.steps || ['']),
    })),
    tags: cloneDeep(source.tags || []),
    technicalAppendix: cloneDeep(source.technicalAppendix || {}),
    classification: source.classification,
    moduleId: source.moduleId,
    source: source.source,
    originalLanguage: source.originalLanguage,
  }
  appendixEntries.value = Object.entries(draft.value.technicalAppendix || {}).map(([k, v]) => ({
    key: k,
    value: String(v || ''),
  }))
  ready.value = true
  setBaseline()
}

const payload = () => {
  const technicalAppendix = Object.fromEntries(
    appendixEntries.value
      .filter((e) => e.key.trim() !== '')
      .map((e) => [e.key.trim(), e.value]),
  )
  return {
    title: draft.value.title,
    goal: draft.value.goal,
    precondition: draft.value.precondition,
    postcondition: draft.value.postcondition,
    mainFlow: draft.value.mainFlow,
    alternativeFlows: draft.value.alternativeFlows,
    tags: draft.value.tags,
    classification: draft.value.classification,
    moduleId: draft.value.moduleId,
    source: draft.value.source,
    originalLanguage: draft.value.originalLanguage,
    technicalAppendix,
  }
}

const autosaveSource = computed(() => ({
  ...draft.value,
  appendixEntries: appendixEntries.value,
}))

const { status, statusMessage, forceSave, setupWatch, setBaseline } = useAutosave(
  id,
  payload,
  (targetId, data) => store.updateRequirement(targetId, data, store.current?.editVersion || 0),
)

setupWatch(autosaveSource, ready)

onMounted(async () => {
  await auth.fetchUser()
  await modulesStore.fetchModules()
  await glossary.fetchTerms()
  await store.fetchVersions(id.value)
  await loadWithLanguage()
  viewLanguage.value = (store.current?.originalLanguage as 'de' | 'en') || 'de'
})

watch(id, async (newId) => {
  if (!newId) return
  await store.fetchVersions(newId)
  await loadWithLanguage()
  viewLanguage.value = (store.current?.originalLanguage as 'de' | 'en') || 'de'
})

onBeforeRouteUpdate(async (to, from) => {
  if (to.params.id !== from.params.id) {
    await forceSave(from.params.id as string)
  }
})

onBeforeRouteLeave(async () => {
  await forceSave()
})

function toggleEdit() {
  if (!isEditable.value) return
  editMode.value = !editMode.value
}

async function submit() {
  await forceSave()
  gateSubmitting.value = true
  try {
    const aiReview = await store.review(id.value)
    if (!aiReview || aiReview.status === 'FAILED') {
      toast.add({ severity: 'error', summary: 'KI-Prüfung fehlgeschlagen', detail: 'Bitte versuche es später erneut.', life: 5000 })
      return
    }
    const result = aiReview.result
    if (result && (result.blockers?.length || result.warnings?.length)) {
      gateReview.value = { id: aiReview.id, result }
      gateIgnoreReason.value = ''
      showSubmitGate.value = true
      return
    }
    await store.submitRequirement(id.value, { aiReviewId: aiReview.id })
    reviewTrigger.value++
    await store.fetchVersions(id.value)
    await loadWithLanguage(viewLanguage.value)
  } finally {
    gateSubmitting.value = false
  }
}

async function approve() {
  await store.approveRequirement(id.value)
  await store.fetchVersions(id.value)
  await loadWithLanguage(viewLanguage.value)
}

async function confirmSubmitWithIgnore() {
  if (!gateReview.value || !gateIgnoreReason.value.trim()) return
  await store.submitRequirement(id.value, {
    aiReviewId: gateReview.value.id,
    ignoreWarningsReason: gateIgnoreReason.value.trim(),
  })
  showSubmitGate.value = false
  reviewTrigger.value++
  await store.fetchVersions(id.value)
  await loadWithLanguage(viewLanguage.value)
}

async function reject() {
  await store.rejectRequirement(id.value, rejectReason.value)
  showReject.value = false
  rejectReason.value = ''
  await store.fetchVersions(id.value)
  await loadWithLanguage(viewLanguage.value)
}

async function reopen() {
  await store.reopenRequirement(id.value)
  await store.fetchVersions(id.value)
  await loadWithLanguage(viewLanguage.value)
}

async function rollback() {
  await store.startEdit(id.value)
  await store.fetchVersions(id.value)
  const originalLang = (store.current?.originalLanguage as 'de' | 'en') || 'de'
  viewLanguage.value = originalLang
  await loadWithLanguage(originalLang)
  editMode.value = true
}

async function onReview(payload: { reviewedByCe?: boolean; reviewedByAscShe?: boolean }) {
  await store.setReview(id.value, payload)
  await store.fetchVersions(id.value)
  await loadWithLanguage(viewLanguage.value)
}

function onCreateComment(anchor: { field: string; text: string; start: number; end: number }) {
  pendingAnchor.value = anchor
  activeTab.value = 3
}

function onCommentJump(anchor: { field: string; text: string; start: number; end: number }) {
  activeTab.value = 0
  nextTick(() => {
    const selector = `[data-field="${anchor.field}"] .ProseMirror`
    const el = document.querySelector(selector) as HTMLElement | null
    if (el) {
      el.focus()
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

async function onCreateJira() {
  jiraLoading.value = true
  try {
    await store.createJiraTicket(id.value)
  } finally {
    jiraLoading.value = false
    await store.fetchVersions(id.value)
    await loadWithLanguage(viewLanguage.value)
  }
}

async function onRestore(versionId: string) {
  await store.rollbackRequirement(id.value, versionId)
  await store.fetchVersions(id.value)
  const originalLang = (store.current?.originalLanguage as 'de' | 'en') || 'de'
  await loadWithLanguage(originalLang)
  viewLanguage.value = originalLang
  editMode.value = true
}

async function onIgnoreWarnings(reason: string) {
  await store.submitRequirement(id.value, { ignoreWarningsReason: reason })
  reviewTrigger.value++
  await store.fetchVersions(id.value)
  await loadWithLanguage(viewLanguage.value)
}

async function runReview() {
  return await store.review(id.value)
}

async function exportUseCase() {
  if (!store.current) return
  try {
    const data = await api.get(`/export/usecases/${id.value}.json`)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    const filename = `usecase-${store.current.humanReadableId || store.current.id}.json`
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: t('app.error'), detail: err.message || 'Export failed', life: 4000 })
  }
}

async function translateTo(language: 'de' | 'en') {
  if (!store.current) return
  if (language === store.current.originalLanguage) {
    toast.add({ severity: 'warn', summary: t('app.error'), detail: t('glossary.translationSameLanguage'), life: 3000 })
    return
  }
  translating.value = true
  try {
    await store.translateRequirement(id.value, language)
    toast.add({ severity: 'success', summary: t('app.success'), detail: t('glossary.translationSaved'), life: 3000 })
    if (viewLanguage.value === language) {
      await loadWithLanguage(language)
    } else {
      viewLanguage.value = language
    }
  } catch (err: any) {
    toast.add({ severity: 'error', summary: t('app.error'), detail: err.message || t('glossary.translationError'), life: 4000 })
  } finally {
    translating.value = false
  }
}

function moveMainStep(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= draft.value.mainFlow.length) return
  const item = draft.value.mainFlow[index]
  draft.value.mainFlow.splice(index, 1)
  draft.value.mainFlow.splice(newIndex, 0, item)
}

function removeMainStep(index: number) {
  draft.value.mainFlow.splice(index, 1)
}

function addMainStep() {
  draft.value.mainFlow.push('')
  nextTick(() => {
    const editors = document.querySelectorAll('.main-step-editor .ProseMirror')
    const last = editors[editors.length - 1] as HTMLElement | undefined
    last?.focus()
  })
}

function addAlternativeFlow() {
  draft.value.alternativeFlows.push({ title: '', afterStep: '', steps: [''] })
}

function removeAlternativeFlow(flowIndex: number) {
  draft.value.alternativeFlows.splice(flowIndex, 1)
}

function addAlternativeStep(flowIndex: number) {
  draft.value.alternativeFlows[flowIndex].steps.push('')
}

function removeAlternativeStep(flowIndex: number, stepIndex: number) {
  draft.value.alternativeFlows[flowIndex].steps.splice(stepIndex, 1)
}

function moveAlternativeStep(flowIndex: number, stepIndex: number, direction: number) {
  const steps = draft.value.alternativeFlows[flowIndex].steps
  const newIndex = stepIndex + direction
  if (newIndex < 0 || newIndex >= steps.length) return
  const item = steps[stepIndex]
  steps.splice(stepIndex, 1)
  steps.splice(newIndex, 0, item)
}

function addAppendixEntry() {
  appendixEntries.value.push({ key: '', value: '' })
}

function removeAppendixEntry(index: number) {
  appendixEntries.value.splice(index, 1)
}


</script>

<template>
  <div v-if="store.current && ready" class="max-w-7xl mx-auto">
    <!-- Document header -->
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-id font-display font-bold text-text">
            {{ store.current.humanReadableId }}
          </h1>
          <span
            class="px-3 py-1 rounded-pill text-sm font-medium"
            :class="statusClass(store.current.status)"
          >
            {{ t(`status.${store.current.status}`) }}
          </span>
          <span
            class="px-3 py-1 rounded-pill text-sm font-medium font-mono"
            :class="classificationClass(store.current.classification)"
          >
            {{ store.current.classification }}
          </span>
          <AutosaveIndicator :status="status" :message="statusMessage" />
        </div>
        <div class="mt-1 text-text-muted text-sm">
          <span v-if="store.current.module" class="font-mono">{{ store.current.module.name }}</span>
          <span v-if="store.current.source" class="ml-2">· {{ store.current.source }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <Button
          :icon="editMode ? 'pi pi-eye' : 'pi pi-pencil'"
          :label="editMode ? t('useCase.actions.view') : t('useCase.actions.edit')"
          :disabled="!isEditable"
          text
          @click="toggleEdit"
        />
        <Button
          v-if="store.current.status === 'DRAFT' || store.current.status === 'IN_REVIEW' || store.current.status === 'IMPORTED'"
          icon="pi pi-send"
          :label="t('useCase.actions.submit')"
          @click="submit"
        />
        <Button
          v-if="auth.isAdmin && store.current.status === 'SUBMITTED_FOR_RELEASE'"
          icon="pi pi-check"
          :label="t('useCase.actions.approve')"
          @click="approve"
        />
        <Button
          v-if="auth.isAdmin && store.current.status === 'SUBMITTED_FOR_RELEASE'"
          icon="pi pi-times"
          :label="t('useCase.actions.reject')"
          severity="danger"
          @click="showReject = true"
        />
        <Button
          v-if="auth.isAdmin && (store.current.status === 'APPROVED' || store.current.status === 'REJECTED' || store.current.status === 'POSTPONED')"
          icon="pi pi-replay"
          :label="t('useCase.actions.reopen')"
          @click="reopen"
        />
        <Button
          v-if="store.current.status !== 'DRAFT' && store.current.status !== 'IN_REVIEW' && store.current.status !== 'IMPORTED'"
          icon="pi pi-undo"
          :label="t('useCase.actions.rollback')"
          text
          @click="rollback"
        />
      </div>
    </div>

    <TabView v-model:activeIndex="activeTab">
      <TabPanel value="0" header="Editor">
        <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          <!-- Spec-Spine -->
          <aside class="lg:sticky lg:top-20 space-y-5 bg-surface border border-border rounded-card p-4 h-fit">
            <div class="space-y-1">
              <div class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.id') }}</div>
              <div class="font-mono text-text">{{ store.current.humanReadableId }}</div>
            </div>

            <div class="space-y-1">
              <div class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.status') }}</div>
              <span class="inline-block px-3 py-1 rounded-pill text-sm font-medium" :class="statusClass(store.current.status)">
                {{ t(`status.${store.current.status}`) }}
              </span>
            </div>

            <div class="space-y-1">
              <div class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.classification') }}</div>
              <div v-if="!editMode">
                <span class="inline-block px-3 py-1 rounded-pill text-sm font-medium font-mono" :class="classificationClass(store.current.classification)">
                  {{ store.current.classification }}
                </span>
              </div>
              <Select
                v-else
                v-model="draft.classification"
                :options="classificationOptions"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>

            <div class="space-y-1">
              <div class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.originalLanguage') }}</div>
              <div class="font-mono text-text uppercase">{{ store.current.originalLanguage || 'de' }}</div>
            </div>

            <div class="space-y-1">
              <div class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.viewLanguage') }}</div>
              <Select
                v-model="viewLanguage"
                :options="languageOptions"
                option-label="label"
                option-value="value"
                class="w-full"
                :disabled="editMode"
              />
            </div>

            <div class="space-y-2">
              <div class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.tags') }}</div>
              <TagInput v-model="draft.tags" :disabled="!editMode" />
            </div>

            <div class="border-t border-border pt-3 space-y-3">
              <div class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.review.title') }}</div>
              <ReviewPanel :requirement="store.current" :user="auth.user" :disabled="!editMode" @update="onReview" />
            </div>

            <div v-if="auth.isAdmin && store.current.reviewedByAscShe" class="border-t border-border pt-3">
              <JiraButton
                :issue-key="store.current.jiraIssueKey"
                :issue-url="store.current.jiraIssueUrl"
                :loading="jiraLoading"
                @create="onCreateJira"
              />
            </div>

            <div class="border-t border-border pt-3 flex flex-wrap gap-2">
              <Button icon="pi pi-download" :label="t('useCase.actions.export')" text size="small" @click="exportUseCase" />
              <Button icon="pi pi-language" :label="t('useCase.actions.translate')" text size="small" :disabled="!canTranslate" :loading="translating" @click="translateTo(viewLanguage)" />
            </div>
          </aside>

          <!-- Document -->
          <div class="space-y-8">
            <!-- Title -->
            <section>
              <div v-if="!editMode" class="text-h1 font-display font-semibold text-text leading-tight">
                {{ draft.title || '–' }}
              </div>
              <div v-else>
                <label class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.title') }}</label>
                <InputText v-model="draft.title" :placeholder="t('useCase.title')" class="w-full mt-1" />
              </div>
            </section>

            <!-- Goal -->
            <section class="border-b border-border pb-6">
              <label class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.goal') }}</label>
              <div class="mt-2">
                <TiptapEditor
                  v-model="draft.goal"
                  :editable="editMode"
                  :terms="glossary.terms"
                  :placeholder="t('useCase.goal')"
                  field="goal"
                  @create-comment="onCreateComment"
                />
              </div>
            </section>

            <!-- Precondition -->
            <section class="border-b border-border pb-6">
              <label class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.precondition') }}</label>
              <div class="mt-2">
                <TiptapEditor
                  v-model="draft.precondition"
                  :editable="editMode"
                  :terms="glossary.terms"
                  :placeholder="t('useCase.precondition')"
                  field="precondition"
                  @create-comment="onCreateComment"
                />
              </div>
            </section>

            <!-- Main flow -->
            <section class="border-b border-border pb-6">
              <div class="flex items-center justify-between mb-3">
                <label class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.mainFlow') }}</label>
                <Button v-if="editMode" icon="pi pi-plus" :label="t('useCase.actions.addStep')" size="small" text @click="addMainStep" />
              </div>
              <ol class="space-y-3">
                <li
                  v-for="(step, index) in draft.mainFlow"
                  :key="`main-${index}`"
                  class="main-step-editor flex items-start gap-3"
                >
                  <span class="font-mono text-text-subtle text-sm mt-2 w-6 text-right">{{ index + 1 }}.</span>
                  <div class="flex-1">
                    <TiptapEditor
                      v-model="draft.mainFlow[index]"
                      :editable="editMode"
                      :terms="glossary.terms"
                      :placeholder="`${t('useCase.mainFlow')} ${index + 1}`"
                      :field="`mainFlow.${index}`"
                      @create-comment="onCreateComment"
                    />
                  </div>
                  <div v-if="editMode" class="flex flex-col gap-1">
                    <Button icon="pi pi-arrow-up" text size="small" :title="t('useCase.actions.moveUp')" @click="moveMainStep(index, -1)" />
                    <Button icon="pi pi-arrow-down" text size="small" :title="t('useCase.actions.moveDown')" @click="moveMainStep(index, 1)" />
                    <Button icon="pi pi-trash" text size="small" severity="danger" :title="t('useCase.actions.removeStep')" @click="removeMainStep(index)" />
                  </div>
                </li>
                <li v-if="!draft.mainFlow?.length" class="text-text-subtle text-sm">
                  {{ editMode ? t('useCase.actions.addStep') : '–' }}
                </li>
              </ol>
            </section>

            <!-- Alternative flows -->
            <section class="border-b border-border pb-6">
              <div class="flex items-center justify-between mb-3">
                <label class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.alternativeFlows') }}</label>
                <Button v-if="editMode" icon="pi pi-plus" :label="t('useCase.actions.addFlow')" size="small" text @click="addAlternativeFlow" />
              </div>
              <div class="space-y-4">
                <div
                  v-for="(flow, flowIndex) in draft.alternativeFlows"
                  :key="`flow-${flowIndex}`"
                  class="border border-border rounded-card p-4 bg-surface-2"
                >
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div class="flex items-center gap-3">
                        <span class="px-2 py-1 rounded-field bg-border text-text font-mono text-sm">A{{ flowIndex + 1 }}</span>
                        <span v-if="!editMode" class="font-medium text-text">{{ flow.title || `${t('useCase.flowTitle')} ${flowIndex + 1}` }}</span>
                        <InputText v-else v-model="flow.title" :placeholder="`${t('useCase.flowTitle')} ${flowIndex + 1}`" class="w-full sm:w-64" />
                      </div>
                      <div class="flex items-center gap-2 text-sm">
                        <span class="text-text-muted">{{ t('useCase.mainFlow') }}:</span>
                        <span v-if="!editMode" class="font-mono text-text">{{ flow.afterStep || '–' }}</span>
                        <InputText v-else v-model="flow.afterStep" placeholder="z.B. 2" class="w-20" />
                      </div>
                    </div>
                    <Button v-if="editMode" icon="pi pi-trash" text size="small" severity="danger" :title="t('useCase.actions.removeFlow')" @click="removeAlternativeFlow(flowIndex)" />
                  </div>
                  <ol class="space-y-2">
                    <li
                      v-for="(step, stepIndex) in flow.steps"
                      :key="`flow-${flowIndex}-step-${stepIndex}`"
                      class="flex items-start gap-3"
                    >
                      <span class="font-mono text-text-subtle text-sm mt-2 w-6 text-right">{{ stepIndex + 1 }}.</span>
                      <div class="flex-1">
                        <TiptapEditor
                          v-model="flow.steps[stepIndex]"
                          :editable="editMode"
                          :terms="glossary.terms"
                          :placeholder="`${t('useCase.alternativeFlows')} A${flowIndex + 1}.${stepIndex + 1}`"
                          :field="`altFlow.${flowIndex}.step.${stepIndex}`"
                          @create-comment="onCreateComment"
                        />
                      </div>
                      <div v-if="editMode" class="flex flex-col gap-1">
                        <Button icon="pi pi-arrow-up" text size="small" :title="t('useCase.actions.moveUp')" @click="moveAlternativeStep(flowIndex, stepIndex, -1)" />
                        <Button icon="pi pi-arrow-down" text size="small" :title="t('useCase.actions.moveDown')" @click="moveAlternativeStep(flowIndex, stepIndex, 1)" />
                        <Button icon="pi pi-trash" text size="small" severity="danger" :title="t('useCase.actions.removeStep')" @click="removeAlternativeStep(flowIndex, stepIndex)" />
                      </div>
                    </li>
                    <li v-if="editMode" class="pl-9">
                      <Button icon="pi pi-plus" :label="t('useCase.actions.addStep')" size="small" text @click="addAlternativeStep(flowIndex)" />
                    </li>
                  </ol>
                </div>
                <div v-if="!draft.alternativeFlows?.length" class="text-text-subtle text-sm">
                  {{ editMode ? t('useCase.actions.addFlow') : '–' }}
                </div>
              </div>
            </section>

            <!-- Postcondition -->
            <section class="border-b border-border pb-6">
              <label class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.postcondition') }}</label>
              <div class="mt-2">
                <TiptapEditor
                  v-model="draft.postcondition"
                  :editable="editMode"
                  :terms="glossary.terms"
                  :placeholder="t('useCase.postcondition')"
                  field="postcondition"
                  @create-comment="onCreateComment"
                />
              </div>
            </section>

            <!-- Technical Appendix -->
            <section class="border-b border-border pb-6">
              <div class="flex items-center justify-between mb-3">
                <label class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.technicalAppendix') }}</label>
                <Button v-if="editMode" icon="pi pi-plus" :label="t('useCase.actions.addAppendix')" size="small" text @click="addAppendixEntry" />
              </div>
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-border">
                    <th class="py-2 pr-4 text-sm font-medium text-text-muted font-mono">Key</th>
                    <th class="py-2 pr-4 text-sm font-medium text-text-muted">Value</th>
                    <th v-if="editMode" class="py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(entry, index) in appendixEntries" :key="`appendix-${index}`" class="border-b border-border">
                    <td class="py-2 pr-4 align-top">
                      <div v-if="!editMode" class="font-mono text-text">{{ entry.key || '–' }}</div>
                      <InputText v-else v-model="entry.key" class="w-full" />
                    </td>
                    <td class="py-2 pr-4 align-top">
                      <div v-if="!editMode" class="text-text whitespace-pre-wrap">{{ entry.value || '–' }}</div>
                      <Textarea v-else v-model="entry.value" rows="2" class="w-full" />
                    </td>
                    <td v-if="editMode" class="py-2 align-top">
                      <Button icon="pi pi-trash" text size="small" severity="danger" :title="t('useCase.actions.removeAppendix')" @click="removeAppendixEntry(index)" />
                    </td>
                  </tr>
                  <tr v-if="!appendixEntries.length">
                    <td colspan="3" class="py-2 text-text-subtle text-sm">{{ editMode ? t('useCase.actions.addAppendix') : '–' }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <!-- Source / Module -->
            <section class="space-y-6 border-t border-border pt-6">
              <div v-if="editMode" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.source') }}</label>
                  <InputText v-model="draft.source" class="w-full mt-1" />
                </div>
                <div>
                  <label class="text-label uppercase tracking-wide text-text-muted">{{ t('useCase.module') }}</label>
                  <Select
                    v-model="draft.moduleId"
                    :options="modulesStore.modules"
                    option-label="name"
                    option-value="id"
                    class="w-full mt-1"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="1" header="KI-Prüfung">
        <AIReviewPanel :key="reviewTrigger" :auto-run="reviewTrigger > 0" :review-fn="runReview" :on-ignore-warnings="onIgnoreWarnings" />
      </TabPanel>

      <TabPanel value="2" header="Versionen">
        <VersionTimeline :requirement-id="id" :versions="store.versions" @restore="onRestore" />
      </TabPanel>

      <TabPanel value="3" header="Kommentare">
        <CommentList :requirement-id="id" v-model:pending-anchor="pendingAnchor" @jump="onCommentJump" />
      </TabPanel>
    </TabView>

    <Dialog v-model:visible="showReject" header="Ablehnen" modal>
      <div class="space-y-3 min-w-96">
        <Textarea v-model="rejectReason" placeholder="Begründung" class="w-full" />
        <Button :label="t('useCase.actions.reject')" severity="danger" class="w-full" @click="reject" />
      </div>
    </Dialog>

    <Dialog v-model:visible="showSubmitGate" header="KI-Prüfung" modal>
      <div class="space-y-4 min-w-[28rem]" v-if="gateReview">
        <div v-if="gateReview.result.blockers?.length" class="space-y-2">
          <h4 class="font-display font-semibold text-glossary-alias">Blocker</h4>
          <ul class="list-disc pl-5 space-y-1">
            <li v-for="(b, i) in gateReview.result.blockers" :key="`b-${i}`">
              <strong>{{ b.field }}:</strong> {{ b.message }}
              <span v-if="b.suggestion" class="text-sm text-text-muted">({{ b.suggestion }})</span>
            </li>
          </ul>
        </div>
        <div v-if="gateReview.result.warnings?.length" class="space-y-2">
          <h4 class="font-display font-semibold text-status-in-review-fg">Warnungen</h4>
          <ul class="list-disc pl-5 space-y-1">
            <li v-for="(w, i) in gateReview.result.warnings" :key="`w-${i}`">
              <strong>{{ w.field }}:</strong> {{ w.message }}
            </li>
          </ul>
          <div v-if="!gateReview.result.blockers?.length" class="space-y-2">
            <Textarea v-model="gateIgnoreReason" placeholder="Begründung für das Ignorieren der Warnungen" rows="3" class="w-full" />
            <Button label="Mit Begründung zur Freigabe" class="w-full" @click="confirmSubmitWithIgnore" />
          </div>
        </div>
        <div v-if="gateReview.result.blockers?.length" class="flex justify-end">
          <Button label="OK" @click="showSubmitGate = false" />
        </div>
      </div>
    </Dialog>
  </div>
</template>
