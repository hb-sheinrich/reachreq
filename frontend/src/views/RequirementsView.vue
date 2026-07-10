<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useRequirementsStore, type Requirement } from '@/stores/requirements'
import { useModulesStore } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useTitle } from '@/composables/useTitle'
import { useToast } from 'primevue/usetoast'
import { api, buildQuery } from '@/services/api'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import AutoComplete from 'primevue/autocomplete'
import Dialog from 'primevue/dialog'
import { classificationClass } from '@/utils/classification'

const router = useRouter()
const route = useRoute()
const store = useRequirementsStore()
const modulesStore = useModulesStore()
const auth = useAuthStore()
const { t } = useI18n()
const toast = useToast()

const filters = ref({
  q: '',
  status: '',
  classification: '',
  moduleId: '',
  tags: [] as string[],
})
const showCreate = ref(false)
const creating = ref(false)
const newReq = ref<Partial<Requirement>>({ title: '', moduleId: '', classification: 'MUST_HAVE', description: '' })

const showImport = ref(false)
const importing = ref(false)
const importOptions = ref({
  moduleId: '',
  classification: 'MUST_HAVE' as 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE' | 'WONT_HAVE',
  status: 'DRAFT' as 'DRAFT' | 'IN_REVIEW',
  targetLanguage: '' as '' | 'de' | 'en',
})
const importFileInput = ref<HTMLInputElement | null>(null)
const importFileName = ref('')
const parsedUseCases = ref<unknown[] | null>(null)
const tagSuggestions = ref<string[]>([])

useTitle(computed(() => t('requirements.title')))

onMounted(() => {
  if (route.query.status) filters.value.status = String(route.query.status)
  if (route.query.classification) filters.value.classification = String(route.query.classification)
  if (route.query.moduleId) filters.value.moduleId = String(route.query.moduleId)
  if (route.query.q) filters.value.q = String(route.query.q)
  if (route.query.tags) {
    filters.value.tags = String(route.query.tags)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  store.fetchRequirements(searchParams.value)
  modulesStore.fetchModules()
})

function getSearchParams() {
  return {
    q: filters.value.q,
    status: filters.value.status,
    classification: filters.value.classification,
    moduleId: filters.value.moduleId,
    tags: filters.value.tags.join(','),
  }
}

const searchParams = computed(getSearchParams)

function search() {
  store.fetchRequirements(searchParams.value)
}

async function create() {
  if (creating.value) return
  creating.value = true
  try {
    const req = await store.createRequirement(newReq.value)
    newReq.value = { title: '', moduleId: '', classification: 'MUST_HAVE', description: '' }
    showCreate.value = false
    router.push({ name: 'RequirementDetail', params: { id: req.id } })
  } finally {
    creating.value = false
  }
}

const statusOptions = computed(() => [
  { label: t('app.all'), value: '' },
  { label: t('status.DRAFT'), value: 'DRAFT' },
  { label: t('status.IN_REVIEW'), value: 'IN_REVIEW' },
  { label: t('status.SUBMITTED_FOR_RELEASE'), value: 'SUBMITTED_FOR_RELEASE' },
  { label: t('status.APPROVED'), value: 'APPROVED' },
  { label: t('status.REJECTED'), value: 'REJECTED' },
  { label: t('status.POSTPONED'), value: 'POSTPONED' },
])

const classificationOptions = computed(() => [
  { label: t('app.all'), value: '' },
  { label: t('classification.MUST_HAVE'), value: 'MUST_HAVE' },
  { label: t('classification.SHOULD_HAVE'), value: 'SHOULD_HAVE' },
  { label: t('classification.NICE_TO_HAVE'), value: 'NICE_TO_HAVE' },
  { label: t('classification.WONT_HAVE'), value: 'WONT_HAVE' },
])

const createClassificationOptions = computed(() => classificationOptions.value.filter((o) => o.value !== ''))

const importClassificationOptions = computed(() => createClassificationOptions.value)
const importStatusOptions = computed(() => [
  { label: t('status.DRAFT'), value: 'DRAFT' },
  { label: t('status.IN_REVIEW'), value: 'IN_REVIEW' },
])

const languageOptions = computed(() => [
  { label: t('app.none'), value: '' },
  { label: 'DE', value: 'de' },
  { label: 'EN', value: 'en' },
])

const statusTokenMap: Record<string, string> = {
  DRAFT: 'draft',
  IN_REVIEW: 'in-review',
  SUBMITTED_FOR_RELEASE: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  POSTPONED: 'postponed',
}

function statusStyle(status: string) {
  const token = statusTokenMap[status] || status.toLowerCase().replace(/_/g, '-')
  return {
    backgroundColor: `var(--status-${token}-bg)`,
    color: `var(--status-${token}-fg)`,
  }
}

async function searchTags(event: { query: string }) {
  try {
    const data = await api.get(`/tags?search=${encodeURIComponent(event.query)}`)
    tagSuggestions.value = (data.tags || []).map((t: { name: string }) => t.name)
  } catch {
    tagSuggestions.value = []
  }
}

async function exportJson() {
  try {
    const params = searchParams.value
    const query = buildQuery(params)
    const data = await api.get(`/export/usecases.json${query}`)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usecases-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: t('app.error'), detail: err.message || 'Export failed', life: 4000 })
  }
}

function openImportFile() {
  importFileInput.value?.click()
}

async function onFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  importFileName.value = file.name
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('JSON is not an array')
    parsedUseCases.value = parsed
    toast.add({ severity: 'success', summary: t('app.success'), detail: `${parsed.length} items parsed`, life: 3000 })
  } catch (err: any) {
    parsedUseCases.value = null
    toast.add({ severity: 'error', summary: t('app.error'), detail: t('requirements.invalidJson'), life: 4000 })
  } finally {
    target.value = ''
  }
}

async function importUseCases() {
  if (!parsedUseCases.value || parsedUseCases.value.length === 0) {
    toast.add({ severity: 'warn', summary: t('app.error'), detail: t('requirements.noFile'), life: 3000 })
    return
  }
  if (!importOptions.value.moduleId) {
    toast.add({ severity: 'warn', summary: t('app.error'), detail: t('requirements.selectModule'), life: 3000 })
    return
  }
  importing.value = true
  try {
    const payload: Record<string, unknown> = {
      moduleId: importOptions.value.moduleId,
      classification: importOptions.value.classification,
      status: importOptions.value.status,
      useCases: parsedUseCases.value,
    }
    if (importOptions.value.targetLanguage) {
      payload.targetLanguage = importOptions.value.targetLanguage
    }
    const data = await api.post('/import/usecases', payload)
    toast.add({ severity: 'success', summary: t('app.success'), detail: t('requirements.importSuccess', { count: data.created || 0 }), life: 3000 })
    showImport.value = false
    parsedUseCases.value = null
    importFileName.value = ''
    store.fetchRequirements(searchParams.value)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: t('app.error'), detail: err.message || t('requirements.importError'), life: 4000 })
  } finally {
    importing.value = false
  }
}

const moduleOptions = computed(() => [
  { label: t('app.all'), value: '' },
  ...modulesStore.modules.map((m) => ({ label: m.name, value: m.id })),
])

const importModuleOptions = computed(() =>
  modulesStore.modules.map((m) => ({ label: m.name, value: m.id }))
)
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h1 class="text-h1 font-display font-semibold text-text">
        {{ $t('requirements.title') }}
      </h1>
      <div class="flex items-center gap-2">
        <Button
          :label="$t('requirements.export')"
          icon="pi pi-download"
          severity="secondary"
          @click="exportJson"
        />
        <Button
          v-if="auth.isAdmin"
          :label="$t('requirements.import')"
          icon="pi pi-upload"
          severity="secondary"
          @click="showImport = true"
        />
        <Button
          :label="$t('requirements.new')"
          icon="pi pi-plus"
          @click="showCreate = true"
        />
      </div>
    </div>
    <div class="flex flex-wrap gap-2 items-center">
      <InputText
        v-model="filters.q"
        :placeholder="$t('requirements.search')"
        class="w-64"
        @keyup.enter="search"
      />
      <Dropdown
        v-model="filters.status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="$t('app.status')"
      />
      <Dropdown
        v-model="filters.classification"
        :options="classificationOptions"
        option-label="label"
        option-value="value"
        :placeholder="$t('app.classification')"
      />
      <Dropdown
        v-model="filters.moduleId"
        :options="moduleOptions"
        option-label="label"
        option-value="value"
        :placeholder="$t('app.module')"
      />
      <AutoComplete
        v-model="filters.tags"
        :suggestions="tagSuggestions"
        multiple
        dropdown
        :force-selection="false"
        :min-length="1"
        :delay="200"
        :placeholder="$t('requirements.tagFilter')"
        class="w-64"
        @complete="searchTags"
      />
      <Button icon="pi pi-search" :label="$t('app.search')" @click="search" />
    </div>
    <DataTable
      :value="store.requirements"
      paginator
      :rows="50"
      :total-records="store.total"
      lazy
      @page="(e) => store.fetchRequirements({ ...searchParams, skip: e.first, take: e.rows })"
    >
      <Column field="humanReadableId" :header="$t('requirements.id')">
        <template #body="{ data }">
          <span class="font-mono text-text">{{ data.humanReadableId }}</span>
        </template>
      </Column>
      <Column field="title" :header="$t('requirements.titleColumn')">
        <template #body="{ data }">
          <router-link
            :to="{ name: 'RequirementDetail', params: { id: data.id } }"
            class="text-link hover:underline"
          >
            {{ data.title }}
          </router-link>
        </template>
      </Column>
      <Column field="module.name" :header="$t('app.module')" />
      <Column field="status" :header="$t('app.status')">
        <template #body="{ data }">
          <span
            class="px-2 py-1 rounded-pill text-sm font-medium"
            :style="statusStyle(data.status)"
          >
            {{ $t(`status.${data.status}`) }}
          </span>
        </template>
      </Column>
      <Column field="classification" :header="$t('app.classification')">
        <template #body="{ data }">
          <span
            class="px-2 py-1 rounded-pill text-sm font-medium font-mono"
            :class="classificationClass(data.classification)"
          >
            {{ data.classification }}
          </span>
        </template>
      </Column>
      <Column field="tags" :header="$t('requirements.tags')">
        <template #body="{ data }">
          <div class="flex flex-wrap gap-1">
            <span
              v-for="tag in data.tags || []"
              :key="tag"
              class="px-2 py-0.5 rounded-pill bg-surface-2 text-text-muted text-xs font-mono"
            >
              {{ tag }}
            </span>
            <span v-if="!(data.tags || []).length" class="text-text-subtle text-sm">–</span>
          </div>
        </template>
      </Column>
      <Column field="author.name" :header="$t('app.author')" />
    </DataTable>

    <Dialog v-model:visible="showCreate" :header="$t('requirements.new')" modal>
      <div class="space-y-4 min-w-96">
        <div>
          <label class="text-label uppercase tracking-wide text-text-muted">{{ $t('requirements.titleColumn') }}</label>
          <InputText v-model="newReq.title" :placeholder="$t('requirements.titleColumn')" class="w-full mt-1" />
        </div>
        <div>
          <label class="text-label uppercase tracking-wide text-text-muted">{{ $t('app.module') }}</label>
          <Dropdown
            v-model="newReq.moduleId"
            :options="modulesStore.modules"
            option-label="name"
            option-value="id"
            :placeholder="$t('app.module')"
            class="w-full mt-1"
          />
        </div>
        <div>
          <label class="text-label uppercase tracking-wide text-text-muted">{{ $t('app.classification') }}</label>
          <Dropdown
            v-model="newReq.classification"
            :options="createClassificationOptions"
            option-label="label"
            option-value="value"
            :placeholder="$t('app.classification')"
            class="w-full mt-1"
          />
        </div>
        <Button
          :label="$t('app.create')"
          class="w-full"
          :loading="creating"
          :disabled="!newReq.title || !newReq.moduleId || creating"
          @click="create"
        />
      </div>
    </Dialog>

    <Dialog v-model:visible="showImport" :header="$t('requirements.importTitle')" modal>
      <div class="space-y-4 min-w-[28rem]">
        <input
          ref="importFileInput"
          type="file"
          accept=".json,application/json"
          class="hidden"
          @change="onFileSelect"
        />
        <Button
          type="button"
          icon="pi pi-file"
          :label="importFileName || $t('requirements.selectFile')"
          class="w-full"
          @click="openImportFile"
        />
        <Dropdown
          v-model="importOptions.moduleId"
          :options="importModuleOptions"
          option-label="label"
          option-value="value"
          :placeholder="$t('requirements.selectModule')"
          class="w-full"
        />
        <Dropdown
          v-model="importOptions.classification"
          :options="importClassificationOptions"
          option-label="label"
          option-value="value"
          :placeholder="$t('requirements.selectClassification')"
          class="w-full"
        />
        <Dropdown
          v-model="importOptions.status"
          :options="importStatusOptions"
          option-label="label"
          option-value="value"
          :placeholder="$t('requirements.selectStatus')"
          class="w-full"
        />
        <Dropdown
          v-model="importOptions.targetLanguage"
          :options="languageOptions"
          option-label="label"
          option-value="value"
          :placeholder="$t('requirements.targetLanguage')"
          class="w-full"
        />
        <Button
          :label="$t('requirements.import')"
          icon="pi pi-upload"
          class="w-full"
          :loading="importing"
          :disabled="!parsedUseCases || !importOptions.moduleId || importing"
          @click="importUseCases"
        />
      </div>
    </Dialog>
  </div>
</template>
