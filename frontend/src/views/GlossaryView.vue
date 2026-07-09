<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGlossaryStore } from '@/stores/glossary'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import Dialog from 'primevue/dialog'

const router = useRouter()
const store = useGlossaryStore()

const filters = ref({ q: '', status: '' })
const showCreate = ref(false)
const newEntry = ref({ term: '', definition: '', tags: '' })

onMounted(() => store.fetchEntries())

function search() {
  store.fetchEntries(filters.value as any)
}

async function create() {
  const entry = await store.createEntry({
    term: newEntry.value.term,
    definition: newEntry.value.definition,
    tags: newEntry.value.tags.split(',').map((t) => t.trim()).filter(Boolean),
  })
  showCreate.value = false
  router.push({ name: 'GlossaryDetail', params: { id: entry.id } })
}

const statusOptions = [
  { label: 'Alle', value: '' },
  { label: 'Entwurf', value: 'DRAFT' },
  { label: 'Zur Freigabe', value: 'SUBMITTED_FOR_RELEASE' },
  { label: 'Freigegeben', value: 'APPROVED' },
  { label: 'Abgelehnt', value: 'REJECTED' },
  { label: 'Archiviert', value: 'ARCHIVED' },
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold">Glossar</h1>
      <Button label="Neuer Eintrag" icon="pi pi-plus" @click="showCreate = true" />
    </div>
    <div class="flex gap-2">
      <InputText v-model="filters.q" placeholder="Suche" class="w-64" @keyup.enter="search" />
      <Dropdown v-model="filters.status" :options="statusOptions" option-label="label" option-value="value" placeholder="Status" />
      <Button icon="pi pi-search" label="Suchen" @click="search" />
    </div>
    <DataTable :value="store.entries" paginator :rows="50" :total-records="store.total" lazy>
      <Column field="term" header="Begriff">
        <template #body="{ data }">
          <router-link :to="{ name: 'GlossaryDetail', params: { id: data.id } }" class="text-blue-600 hover:underline">
            {{ data.term }}
          </router-link>
        </template>
      </Column>
      <Column field="definition" header="Definition" />
      <Column field="status" header="Status">
        <template #body="{ data }">
          <span class="px-2 py-1 rounded text-xs font-semibold" :class="{
            'bg-gray-200': data.status === 'DRAFT',
            'bg-yellow-200': data.status === 'SUBMITTED_FOR_RELEASE',
            'bg-green-200': data.status === 'APPROVED',
            'bg-red-200': data.status === 'REJECTED',
            'bg-purple-200': data.status === 'ARCHIVED',
          }">{{ $t(`status.${data.status}`) }}</span>
        </template>
      </Column>
      <Column field="author.name" header="Autor" />
    </DataTable>

    <Dialog v-model:visible="showCreate" header="Neuer Glossar-Eintrag" modal>
      <div class="space-y-3 min-w-96">
        <InputText v-model="newEntry.term" placeholder="Begriff" class="w-full" />
        <InputText v-model="newEntry.definition" placeholder="Definition" class="w-full" />
        <InputText v-model="newEntry.tags" placeholder="Tags (kommasepariert)" class="w-full" />
        <Button label="Erstellen" class="w-full" @click="create" />
      </div>
    </Dialog>
  </div>
</template>
