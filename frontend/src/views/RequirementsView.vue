<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRequirementsStore, type Requirement } from '@/stores/requirements'
import { useModulesStore } from '@/stores/modules'
import { useTitle } from '@/composables/useTitle'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import Dialog from 'primevue/dialog'

const router = useRouter()
const route = useRoute()
const store = useRequirementsStore()
const modulesStore = useModulesStore()

const filters = ref({ q: '', status: '', classification: '', moduleId: '' })
const showCreate = ref(false)
const creating = ref(false)
const newReq = ref<Partial<Requirement>>({ title: '', moduleId: '', classification: 'MUST_HAVE', description: '' })

useTitle()

onMounted(() => {
  if (route.query.status) filters.value.status = String(route.query.status)
  if (route.query.classification) filters.value.classification = String(route.query.classification)
  store.fetchRequirements(filters.value as any)
  modulesStore.fetchModules()
})

function search() {
  store.fetchRequirements(filters.value as any)
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

const statusOptions = [
  { label: 'Alle', value: '' },
  { label: 'Entwurf', value: 'DRAFT' },
  { label: 'In Prüfung', value: 'IN_REVIEW' },
  { label: 'Zur Freigabe', value: 'SUBMITTED_FOR_RELEASE' },
  { label: 'Freigegeben', value: 'APPROVED' },
  { label: 'Abgelehnt', value: 'REJECTED' },
]

const classificationOptions = [
  { label: 'Alle', value: '' },
  { label: 'Must have', value: 'MUST_HAVE' },
  { label: 'Should have', value: 'SHOULD_HAVE' },
  { label: 'Nice to have', value: 'NICE_TO_HAVE' },
  { label: "Won't have", value: 'WONT_HAVE' },
]

const createClassificationOptions = classificationOptions.filter((o) => o.value !== '')

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
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h1 class="text-h1 font-display font-semibold text-text">Anforderungen</h1>
      <Button label="Neue Anforderung" icon="pi pi-plus" @click="showCreate = true" />
    </div>
    <div class="flex gap-2">
      <InputText v-model="filters.q" placeholder="Suche" class="w-64" @keyup.enter="search" />
      <Dropdown v-model="filters.status" :options="statusOptions" option-label="label" option-value="value" placeholder="Status" />
      <Dropdown v-model="filters.classification" :options="classificationOptions" option-label="label" option-value="value" placeholder="Klassifizierung" />
      <Dropdown v-model="filters.moduleId" :options="[{ label: 'Alle', value: '' }, ...modulesStore.modules.map(m => ({ label: m.name, value: m.id }))]" option-label="label" option-value="value" placeholder="Modul" />
      <Button icon="pi pi-search" label="Suchen" @click="search" />
    </div>
    <DataTable :value="store.requirements" paginator :rows="50" :total-records="store.total" lazy>
      <Column field="humanReadableId" header="ID" />
      <Column field="title" header="Titel">
        <template #body="{ data }">
          <router-link :to="{ name: 'RequirementDetail', params: { id: data.id } }" class="text-link hover:underline">
            {{ data.title }}
          </router-link>
        </template>
      </Column>
      <Column field="module.name" header="Modul" />
      <Column field="status" header="Status">
        <template #body="{ data }">
          <span class="px-2 py-1 rounded-pill text-sm font-medium" :style="statusStyle(data.status)">
            {{ $t(`status.${data.status}`) }}
          </span>
        </template>
      </Column>
      <Column field="classification" header="Klassifizierung" />
      <Column field="author.name" header="Autor" />
    </DataTable>

    <Dialog v-model:visible="showCreate" header="Neue Anforderung" modal>
      <div class="space-y-3 min-w-96">
        <InputText v-model="newReq.title" placeholder="Titel" class="w-full" />
        <Dropdown v-model="newReq.moduleId" :options="modulesStore.modules" option-label="name" option-value="id" placeholder="Modul" class="w-full" />
        <Dropdown v-model="newReq.classification" :options="createClassificationOptions" option-label="label" option-value="value" placeholder="Klassifizierung" class="w-full" />
        <Button label="Erstellen" class="w-full" :loading="creating" :disabled="!newReq.title || !newReq.moduleId || creating" @click="create" />
      </div>
    </Dialog>
  </div>
</template>
