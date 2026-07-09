import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/services/api'

export interface Module {
  id: string
  name: string
  code: string
  description?: string
  parentId?: string | null
  sortOrder: number
  path?: string
  children?: Module[]
}

export const useModulesStore = defineStore('modules', () => {
  const modules = ref<Module[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const tree = computed(() => buildTree(modules.value))

  function buildTree(flat: Module[]) {
    const map = new Map<string, Module & { children: Module[] }>()
    const roots: Module[] = []
    for (const m of flat) {
      map.set(m.id, { ...m, children: [] })
    }
    for (const m of flat) {
      const node = map.get(m.id)!
      if (m.parentId && map.has(m.parentId)) {
        map.get(m.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }

  async function fetchModules() {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/modules')
      modules.value = data.modules
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function createModule(payload: Partial<Module>) {
    const data = await api.post('/modules', payload)
    await fetchModules()
    return data.module
  }

  async function updateModule(id: string, payload: Partial<Module>) {
    const data = await api.patch(`/modules/${id}`, payload)
    await fetchModules()
    return data.module
  }

  async function deleteModule(id: string) {
    await api.delete(`/modules/${id}`)
    await fetchModules()
  }

  async function moveModule(id: string, payload: { parentId?: string | null; sortOrder?: number }) {
    const data = await api.post(`/modules/${id}/move`, payload)
    await fetchModules()
    return data.module
  }

  return { modules, tree, loading, error, fetchModules, createModule, updateModule, deleteModule, moveModule }
})
