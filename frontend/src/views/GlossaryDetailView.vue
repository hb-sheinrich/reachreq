<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, onBeforeRouteUpdate, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGlossaryStore, type GlossaryTranslation } from '@/stores/glossary'
import { useAuthStore } from '@/stores/auth'
import { useAutosave } from '@/services/autosave'
import { useTitle } from '@/composables/useTitle'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import InputChips from 'primevue/inputchips'
import Select from 'primevue/select'
import TabPanel from 'primevue/tabpanel'
import TabView from 'primevue/tabview'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import AutosaveIndicator from '@/components/AutosaveIndicator.vue'
import AIReviewPanel from '@/components/AIReviewPanel.vue'
import CommentList from '@/components/CommentList.vue'

const route = useRoute()
const store = useGlossaryStore()
const auth = useAuthStore()
const { t, locale } = useI18n()
const toast = useToast()

const id = computed(() => route.params.id as string)
const draft = ref<any>({})
const ready = ref(false)
const activeTab = ref(0)
const showReject = ref(false)
const rejectReason = ref('')
const reviewTrigger = ref(0)
const viewLanguage = ref<'de' | 'en'>((locale.value as 'de' | 'en') || 'de')
const translating = ref(false)
const translationResult = ref<GlossaryTranslation | null>(null)

useTitle(computed(() => store.current?.term || ''))

onMounted(async () => {
  await store.fetchEntry(id.value)
  await store.fetchVersions(id.value)
  await loadTranslation()
  initDraft()
})

watch(id, async (newId) => {
  translationResult.value = null
  await store.fetchEntry(newId)
  await store.fetchVersions(newId)
  await loadTranslation()
  initDraft()
})

onBeforeRouteUpdate(async (to, from) => {
  if (to.params.id !== from.params.id) {
    await forceSave(from.params.id as string)
  }
})

onBeforeRouteLeave(async () => {
  await forceSave()
})

watch(viewLanguage, () => {
  translationResult.value = null
  loadTranslation()
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
  const entry = store.current
  draft.value = {
    term: entry.term,
    definition: entry.definition,
    example: entry.example,
    tags: (entry.tags || []).join(', '),
    aliases: cloneDeep(entry.aliases || []),
    originalLanguage: entry.originalLanguage || 'de',
    moduleId: entry.moduleId,
  }
  ready.value = true
}

function payload() {
  return {
    term: draft.value.term,
    definition: draft.value.definition,
    example: draft.value.example || null,
    tags: (draft.value?.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
    aliases: ((draft.value?.aliases || []) as string[]).map((a: string) => a.trim()).filter(Boolean),
    originalLanguage: draft.value.originalLanguage,
    moduleId: draft.value.moduleId || null,
  }
}

const { status, statusMessage, forceSave, setupWatch } = useAutosave(
  id,
  payload,
  (targetId, data) => store.updateEntry(targetId, data)
)

setupWatch(draft, ready)

async function loadTranslation() {
  if (!store.current) return
  if (viewLanguage.value === store.current.originalLanguage) {
    store.translation = null
    return
  }
  await store.fetchTranslation(id.value, viewLanguage.value)
}

async function translate() {
  if (!store.current) return
  if (viewLanguage.value === store.current.originalLanguage) {
    toast.add({ severity: 'warn', summary: t('app.error'), detail: t('glossary.translationSameLanguage'), life: 3000 })
    return
  }
  translating.value = true
  try {
    const result = await store.translateEntry(id.value, viewLanguage.value)
    translationResult.value = result
    await store.fetchTranslation(id.value, viewLanguage.value)
    toast.add({ severity: 'success', summary: t('app.success'), detail: t('glossary.translationSaved'), life: 3000 })
  } catch (err: any) {
    toast.add({ severity: 'error', summary: t('app.error'), detail: err.message || t('glossary.translationError'), life: 4000 })
  } finally {
    translating.value = false
  }
}

async function submit() {
  await forceSave()
  await store.submitEntry(id.value)
  reviewTrigger.value++
}

async function approve() {
  await store.approveEntry(id.value)
}

async function reject() {
  await store.rejectEntry(id.value, rejectReason.value)
  showReject.value = false
}

async function reopen() {
  await store.reopenEntry(id.value)
}

async function runReview() {
  return await store.review(id.value)
}

const languageOptions = computed(() => [
  { label: 'DE', value: 'de' },
  { label: 'EN', value: 'en' },
])

const isTranslation = computed(() => store.current !== null && viewLanguage.value !== store.current.originalLanguage)

const displayed = computed(() => {
  if (!store.current) return null
  if (!isTranslation.value) return store.current
  return store.translation
})

const canTranslate = computed(() => {
  return store.current && viewLanguage.value !== store.current.originalLanguage && !translating.value
})
</script>

<template>
  <div v-if="store.current" class="space-y-4">
    <div class="flex justify-between items-center">
      <h1 class="text-h1 font-display font-semibold text-text">
        {{ displayed?.term || store.current.term }}
      </h1>
      <div class="flex items-center gap-2">
        <AutosaveIndicator :status="status" :message="statusMessage" />
        <Button v-if="store.current.status === 'DRAFT'" :label="$t('app.submit')" @click="submit" />
        <Button v-if="auth.isAdmin && store.current.status === 'SUBMITTED_FOR_RELEASE'" :label="$t('app.approve')" severity="success" @click="approve" />
        <Button v-if="auth.isAdmin && store.current.status === 'SUBMITTED_FOR_RELEASE'" :label="$t('app.reject')" severity="danger" @click="showReject = true" />
        <Button v-if="auth.isAdmin && (store.current.status === 'APPROVED' || store.current.status === 'REJECTED')" :label="$t('app.reopen')" @click="reopen" />
      </div>
    </div>

    <div class="flex flex-wrap gap-2 items-center p-3 rounded-card bg-surface border border-border">
      <label class="text-sm text-text-muted">{{ $t('glossary.viewLanguage') }}</label>
      <Select
        v-model="viewLanguage"
        :options="languageOptions"
        option-label="label"
        option-value="value"
        class="w-32"
      />
      <Button
        :label="$t('glossary.translate')"
        icon="pi pi-language"
        :disabled="!canTranslate"
        :loading="translating"
        @click="translate"
      />
      <span v-if="translationResult" class="text-sm text-text-muted">
        {{ $t('glossary.translationResult') }}
      </span>
    </div>

    <div v-if="isTranslation && displayed" class="space-y-3 p-4 rounded-card bg-surface border border-border">
      <h2 class="text-h2 font-display font-semibold text-text">
        {{ $t('glossary.translation') }}
      </h2>
      <div class="space-y-1">
        <div class="text-label uppercase text-text-muted">{{ $t('glossary.term') }}</div>
        <div class="text-text">{{ displayed.term }}</div>
      </div>
      <div class="space-y-1">
        <div class="text-label uppercase text-text-muted">{{ $t('glossary.definition') }}</div>
        <div class="text-text">{{ displayed.definition }}</div>
      </div>
      <div v-if="displayed.aliases && displayed.aliases.length" class="space-y-1">
        <div class="text-label uppercase text-text-muted">{{ $t('glossary.aliases') }}</div>
        <div class="flex flex-wrap gap-1">
          <Tag v-for="alias in displayed.aliases" :key="alias" :value="alias" severity="secondary" class="text-xs" />
        </div>
      </div>
    </div>

    <TabView v-model:activeIndex="activeTab">
      <TabPanel value="0" :header="$t('glossary.editor')">
        <div class="space-y-4">
          <div class="space-y-1">
            <label class="text-label uppercase text-text-muted">{{ $t('glossary.term') }}</label>
            <InputText v-model="draft.term" :placeholder="$t('glossary.term')" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-label uppercase text-text-muted">{{ $t('glossary.definition') }}</label>
            <Textarea v-model="draft.definition" :placeholder="$t('glossary.definition')" rows="4" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-label uppercase text-text-muted">{{ $t('glossary.example') }}</label>
            <Textarea v-model="draft.example" :placeholder="$t('glossary.example')" rows="3" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-label uppercase text-text-muted">{{ $t('glossary.aliases') }}</label>
            <InputChips
              v-model="draft.aliases"
              class="w-full"
              separator=","
              :allow-duplicate="false"
              :placeholder="$t('glossary.aliases')"
            />
          </div>
          <div class="space-y-1">
            <label class="text-label uppercase text-text-muted">{{ $t('glossary.originalLanguage') }}</label>
            <Select
              v-model="draft.originalLanguage"
              :options="languageOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              :placeholder="$t('glossary.originalLanguage')"
            />
          </div>
          <div class="space-y-1">
            <label class="text-label uppercase text-text-muted">{{ $t('app.tags') }}</label>
            <InputText v-model="draft.tags" :placeholder="$t('app.tags') + ' (comma-separated)'" class="w-full" />
          </div>
        </div>
      </TabPanel>
      <TabPanel value="1" :header="$t('app.review')">
        <AIReviewPanel :key="reviewTrigger" :review-fn="runReview" />
      </TabPanel>
      <TabPanel value="2" :header="$t('glossary.versions')">
        <ul class="space-y-2">
          <li v-for="v in store.versions" :key="v.id" class="border border-border p-2 rounded-card bg-surface">
            <div class="flex justify-between">
              <span class="font-bold">Version {{ v.versionNumber }}</span>
              <span class="text-sm text-text-muted">{{ new Date(v.createdAt).toLocaleString() }}</span>
            </div>
            <div>{{ v.term }}</div>
          </li>
        </ul>
      </TabPanel>
      <TabPanel value="3" :header="$t('glossary.comments')">
        <CommentList :glossary-entry-id="id" />
      </TabPanel>
    </TabView>

    <Dialog v-model:visible="showReject" :header="$t('app.reject')" modal>
      <div class="space-y-3 min-w-96">
        <Textarea v-model="rejectReason" :placeholder="$t('app.reject')" class="w-full" />
        <Button :label="$t('app.reject')" severity="danger" class="w-full" @click="reject" />
      </div>
    </Dialog>
  </div>
</template>
