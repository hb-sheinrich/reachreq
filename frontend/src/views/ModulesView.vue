<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useModulesStore, type Module } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useTitle } from '@/composables/useTitle'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tree from 'primevue/tree'
import Dialog from 'primevue/dialog'

const store = useModulesStore()
const auth = useAuthStore()

const showCreate = ref(false)
const showEdit = ref(false)
const editing = ref<Partial<Module>>({})
const newModule = ref<Partial<Module>>({ code: '', name: '', description: '', parentId: null, sortOrder: 0 })
const expandedKeys = ref<Record<string, boolean>>({})

useTitle()

onMounted(() => store.fetchModules())

function asTreeNodes(nodes: any[]): any[] {
  return nodes.map((n) => ({
    key: n.id,
    label: `${n.name} (${n.code})`,
    data: n,
    children: asTreeNodes(n.children || []),
  }))
}

async function create() {
  const payload = { ...newModule.value, sortOrder: newModule.value.sortOrder ?? 0 }
  await store.createModule(payload)
  showCreate.value = false
  newModule.value = { code: '', name: '', description: '', parentId: null, sortOrder: 0 }
}

function editNode(node: any) {
  editing.value = { ...node.data }
  showEdit.value = true
}

async function saveEdit() {
  const payload = { ...editing.value, sortOrder: editing.value.sortOrder ?? 0 }
  if (payload.sortOrder == null) delete (payload as any).sortOrder
  await store.updateModule(editing.value.id!, payload)
  showEdit.value = false
}

async function remove(id: string) {
  if (!confirm('Modul wirklich löschen?')) return
  await store.deleteModule(id)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h1 class="text-h1 font-display font-semibold text-text">Module</h1>
      <Button v-if="auth.isAuthenticated" label="Neues Modul" icon="pi pi-plus" @click="showCreate = true" />
    </div>
    <Tree v-model:expandedKeys="expandedKeys" :value="asTreeNodes(store.tree)" class="w-full">
      <template #default="{ node }">
        <div class="flex items-center justify-between w-full">
          <span class="text-text">{{ node.label }}</span>
          <div v-if="auth.isAdmin" class="flex gap-1">
            <Button icon="pi pi-pencil" text size="small" @click="editNode(node)" />
            <Button icon="pi pi-trash" text size="small" severity="danger" @click="remove(node.key)" />
          </div>
        </div>
      </template>
    </Tree>

    <Dialog v-model:visible="showCreate" header="Neues Modul" modal>
      <div class="space-y-3 min-w-96">
        <InputText v-model="newModule.name" placeholder="Name" class="w-full" />
        <InputText v-model="newModule.code" placeholder="Code (z.B. LOG)" class="w-full" />
        <Textarea v-model="newModule.description" placeholder="Beschreibung (optional)" rows="3" class="w-full" />
        <Select v-model="newModule.parentId" :options="[{ name: 'Kein Elternmodul', id: null }, ...store.modules]" option-label="name" option-value="id" placeholder="Elternmodul" class="w-full" />
        <InputNumber v-model="newModule.sortOrder" placeholder="Sortierung" class="w-full" />
        <Button label="Erstellen" class="w-full" @click="create" />
      </div>
    </Dialog>

    <Dialog v-model:visible="showEdit" header="Modul bearbeiten" modal>
      <div class="space-y-3 min-w-96">
        <InputText v-model="editing.name" placeholder="Name" class="w-full" />
        <InputText v-model="editing.code" placeholder="Code" class="w-full" />
        <Textarea v-model="editing.description" placeholder="Beschreibung (optional)" rows="3" class="w-full" />
        <Select v-model="editing.parentId" :options="[{ name: 'Kein Elternmodul', id: null }, ...store.modules]" option-label="name" option-value="id" placeholder="Elternmodul" class="w-full" />
        <InputNumber v-model="editing.sortOrder" placeholder="Sortierung" class="w-full" />
        <Button label="Speichern" class="w-full" @click="saveEdit" />
      </div>
    </Dialog>
  </div>
</template>
