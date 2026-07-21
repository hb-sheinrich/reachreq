<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useModulesStore, type Module } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useTitle } from '@/composables/useTitle'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tree from 'primevue/tree'
import Dialog from 'primevue/dialog'

const store = useModulesStore()
const auth = useAuthStore()
const toast = useToast()

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

function validateModule(payload: Partial<Module>, editing = false): string[] {
  const errors: string[] = []
  if (!payload.name || !payload.name.trim()) {
    errors.push('Name ist erforderlich.')
  }
  if (!payload.code || !payload.code.trim()) {
    errors.push('Code ist erforderlich.')
  } else if (payload.code.trim().length > 50) {
    errors.push('Code darf maximal 50 Zeichen lang sein.')
  }
  return errors
}

const isCreateValid = computed(() => {
  const name = newModule.value.name || ''
  const code = newModule.value.code || ''
  return name.trim().length > 0 && code.trim().length > 0 && code.trim().length <= 50
})

const isEditValid = computed(() => {
  const name = editing.value.name || ''
  const code = editing.value.code || ''
  return name.trim().length > 0 && code.trim().length > 0 && code.trim().length <= 50
})

async function create() {
  const payload = { ...newModule.value, sortOrder: newModule.value.sortOrder ?? 0 }
  const errors = validateModule(payload)
  if (errors.length > 0) {
    toast.add({ severity: 'error', summary: 'Modul kann nicht erstellt werden', detail: errors.join(' '), life: 5000 })
    return
  }
  try {
    await store.createModule(payload)
    showCreate.value = false
    newModule.value = { code: '', name: '', description: '', parentId: null, sortOrder: 0 }
    toast.add({ severity: 'success', summary: 'Modul erstellt', detail: 'Das Modul wurde erfolgreich angelegt.', life: 3000 })
  } catch (err: any) {
    const detail = err?.data?.error?.message || err?.data?.error || err?.message || 'Unbekannter Fehler'
    toast.add({ severity: 'error', summary: 'Modul konnte nicht erstellt werden', detail: String(detail), life: 5000 })
  }
}

function editNode(node: any) {
  editing.value = { ...node.data }
  showEdit.value = true
}

async function saveEdit() {
  const payload = { ...editing.value, sortOrder: editing.value.sortOrder ?? 0 }
  if (payload.sortOrder == null) delete (payload as any).sortOrder
  const errors = validateModule(payload, true)
  if (errors.length > 0) {
    toast.add({ severity: 'error', summary: 'Modul kann nicht gespeichert werden', detail: errors.join(' '), life: 5000 })
    return
  }
  try {
    await store.updateModule(editing.value.id!, payload)
    showEdit.value = false
    toast.add({ severity: 'success', summary: 'Modul gespeichert', detail: 'Die Änderungen wurden übernommen.', life: 3000 })
  } catch (err: any) {
    const detail = err?.data?.error?.message || err?.data?.error || err?.message || 'Unbekannter Fehler'
    toast.add({ severity: 'error', summary: 'Modul konnte nicht gespeichert werden', detail: String(detail), life: 5000 })
  }
}

async function remove(id: string) {
  if (!confirm('Modul wirklich löschen?')) return
  try {
    await store.deleteModule(id)
  } catch (err: any) {
    const detail = err?.data?.error?.message || err?.data?.error || err?.message || 'Unbekannter Fehler'
    toast.add({ severity: 'error', summary: 'Löschen fehlgeschlagen', detail: String(detail), life: 5000 })
  }
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
        <Button label="Erstellen" class="w-full" :disabled="!isCreateValid" @click="create" />
      </div>
    </Dialog>

    <Dialog v-model:visible="showEdit" header="Modul bearbeiten" modal>
      <div class="space-y-3 min-w-96">
        <InputText v-model="editing.name" placeholder="Name" class="w-full" />
        <InputText v-model="editing.code" placeholder="Code" class="w-full" />
        <Textarea v-model="editing.description" placeholder="Beschreibung (optional)" rows="3" class="w-full" />
        <Select v-model="editing.parentId" :options="[{ name: 'Kein Elternmodul', id: null }, ...store.modules]" option-label="name" option-value="id" placeholder="Elternmodul" class="w-full" />
        <InputNumber v-model="editing.sortOrder" placeholder="Sortierung" class="w-full" />
        <Button label="Speichern" class="w-full" :disabled="!isEditValid" @click="saveEdit" />
      </div>
    </Dialog>
  </div>
</template>
