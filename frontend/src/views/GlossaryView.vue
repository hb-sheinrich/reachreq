<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGlossaryStore } from '@/stores/glossary'
import { useTitle } from '@/composables/useTitle'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'

const router = useRouter()
const route = useRoute()
const store = useGlossaryStore()
const { t } = useI18n()

const filters = ref({
  q: '',
  status: '',
  alias: '',
})
const showCreate = ref(false)
const newEntry = ref({
  term: '',
  definition: '',
  tags: '',
  aliases: '',
  originalLanguage: 'de' as 'de' | 'en',
})

useTitle(computed(() => t('glossary.title')))

onMounted(() => {
  if (route.query.status) filters.value.status = String(route.query.status)
  store.fetchEntries(filters.value as any)
})

function search() {
  store.fetchEntries({
    q: filters.value.q,
    status: filters.value.status,
  })
}

const filteredEntries = computed(() => {
  const alias = filters.value.alias.trim().toLowerCase()
  if (!alias) return store.entries
  return store.entries.filter((e) =>
    (e.aliases || []).some((a) => a.toLowerCase().includes(alias))
  )
})

async function create() {
  const entry = await store.createEntry({
    term: newEntry.value.term,
    definition: newEntry.value.definition,
    tags: newEntry.value.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    aliases: newEntry.value.aliases
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    originalLanguage: newEntry.value.originalLanguage,
  })
  showCreate.value = false
  newEntry.value = {
    term: '',
    definition: '',
    tags: '',
    aliases: '',
    originalLanguage: 'de',
  }
  router.push({ name: 'GlossaryDetail', params: { id: entry.id } })
}

const statusOptions = computed(() => [
  { label: t('app.all'), value: '' },
  { label: t('status.DRAFT'), value: 'DRAFT' },
  { label: t('status.SUBMITTED_FOR_RELEASE'), value: 'SUBMITTED_FOR_RELEASE' },
  { label: t('status.APPROVED'), value: 'APPROVED' },
  { label: t('status.REJECTED'), value: 'REJECTED' },
  { label: t('status.ARCHIVED'), value: 'ARCHIVED' },
])

const languageOptions = computed(() => [
  { label: 'DE', value: 'de' },
  { label: 'EN', value: 'en' },
])

const statusTokenMap: Record<string, string> = {
  DRAFT: 'draft',
  SUBMITTED_FOR_RELEASE: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
}

function statusStyle(status: string) {
  const token = statusTokenMap[status] || status.toLowerCase().replace(/_/g, '-')
  return {
    backgroundColor: `var(--status-${token}-bg)`,
    color: `var(--status-${token}-fg)`,
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h1 class="text-h1 font-display font-semibold text-text">
        {{ $t('glossary.title') }}
      </h1>
      <Button
        :label="$t('glossary.new')"
        icon="pi pi-plus"
        @click="showCreate = true"
      />
    </div>
    <div class="flex flex-wrap gap-2">
      <InputText
        v-model="filters.q"
        :placeholder="$t('glossary.searchTerm')"
        class="w-64"
        @keyup.enter="search"
      />
      <InputText
        v-model="filters.alias"
        :placeholder="$t('glossary.aliasFilter')"
        class="w-64"
      />
      <Select
        v-model="filters.status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="$t('app.status')"
      />
      <Button icon="pi pi-search" :label="$t('app.search')" @click="search" />
    </div>
    <DataTable
      :value="filteredEntries"
      paginator
      :rows="50"
      :total-records="filteredEntries.length"
    >
      <Column field="term" :header="$t('glossary.term')">
        <template #body="{ data }">
          <router-link
            :to="{ name: 'GlossaryDetail', params: { id: data.id } }"
            class="text-link hover:underline"
          >
            {{ data.term }}
          </router-link>
        </template>
      </Column>
      <Column field="definition" :header="$t('glossary.definition')" />
      <Column field="aliases" :header="$t('glossary.aliases')">
        <template #body="{ data }">
          <div class="flex flex-wrap gap-1">
            <Tag
              v-for="alias in data.aliases || []"
              :key="alias"
              :value="alias"
              severity="secondary"
              class="text-xs"
            />
            <span v-if="!(data.aliases || []).length" class="text-text-subtle text-sm">
              —
            </span>
          </div>
        </template>
      </Column>
      <Column field="originalLanguage" :header="$t('glossary.originalLanguage')">
        <template #body="{ data }">
          <Tag
            :value="(data.originalLanguage || 'de').toUpperCase()"
            severity="info"
            class="text-xs"
          />
        </template>
      </Column>
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
      <Column field="author.name" :header="$t('app.author')">
        <template #body="{ data }">
          <span class="text-sm text-text-muted">
            {{ data.author?.name }}
          </span>
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="showCreate"
      :header="$t('glossary.new')"
      modal
    >
      <div class="space-y-3 min-w-96">
        <InputText
          v-model="newEntry.term"
          :placeholder="$t('glossary.term')"
          class="w-full"
        />
        <InputText
          v-model="newEntry.definition"
          :placeholder="$t('glossary.definition')"
          class="w-full"
        />
        <InputText
          v-model="newEntry.tags"
          :placeholder="$t('app.tags') + ' (comma-separated)'"
          class="w-full"
        />
        <InputText
          v-model="newEntry.aliases"
          :placeholder="$t('glossary.aliases') + ' (comma-separated)'"
          class="w-full"
        />
        <Select
          v-model="newEntry.originalLanguage"
          :options="languageOptions"
          option-label="label"
          option-value="value"
          :placeholder="$t('glossary.originalLanguage')"
          class="w-full"
        />
        <Button
          :label="$t('app.create')"
          class="w-full"
          @click="create"
        />
      </div>
    </Dialog>
  </div>
</template>
