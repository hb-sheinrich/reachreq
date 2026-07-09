<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRequirementsStore, type Requirement } from '@/stores/requirements'
import { useModulesStore } from '@/stores/modules'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import Dialog from 'primevue/dialog'

const router = useRouter()
const store = useRequirementsStore()
const modulesStore = useModulesStore()

const filters = ref({ q: '', status: '', classification: '', moduleId: '' })
const showCreate = ref(false)
const newReq = ref<Partial<Requirement>>({ title: '', moduleId: '', classification: 'MUST_HAVE', description: '' })

onMounted(() => {
  store.fetchRequirements()
  modulesStore.fetchModules()
})

function search() {
  store.fetchRequirements(filters.value as any)
}

async function create() {
  const req = await store.createRequirement(newReq.value)
  showCreate.value = false
  router.push({ name: 'RequirementDetail', params: { id: req.id } })
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
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold">Anforderungen</h1>
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
          <router-link :to="{ name: 'RequirementDetail', params: { id: data.id } }" class="text-blue-600 hover:underline">
            {{ data.title }}
          </router-link>
        </template>
      </Column>
      <Column field="module.name" header="Modul" />
      <Column field="status" header="Status">
        <template #body="{ data }">
          <span class="px-2 py-1 rounded text-xs font-semibold" :class="{
            'bg-gray-200': data.status === 'DRAFT',
            'bg-blue-200': data.status === 'IN_REVIEW',
            'bg-yellow-200': data.status === 'SUBMITTED_FOR_RELEASE',
            'bg-green-200': data.status === 'APPROVED',
            'bg-red-200': data.status === 'REJECTED' || data.status === 'POSTPONED',
          }">{{ $t(`status.${data.status}`) }}</span>
        </template>
      </Column>
      <Column field="classification" header="Klassifizierung" />
      <Column field="author.name" header="Autor" />
    </DataTable>

    <Dialog v-model:visible="showCreate" header="Neue Anforderung" modal>
      <div class="space-y-3 min-w-96">
        <InputText v-model="newReq.title" placeholder="Titel" class="w-full" />
        <Dropdown v-model="newReq.moduleId" :options="modulesStore.modules" option-label="name" option-value="id" placeholder="Modul" class="w-full" />
        <Dropdown v-model="newReq.classification" :options="classificationOptions" option-label="label" option-value="value" placeholder="Klassifizierung" class="w-full" />
        <Button label="Erstellen" class="w-full" @click="create" />
      </div>
    </Dialog>
  </div>
</template>
