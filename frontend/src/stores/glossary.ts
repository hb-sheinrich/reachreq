import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'

export interface GlossaryTerm {
  id: string
  term: string
  aliases: string[]
  definition: string
  status: string
  moduleId?: string | null
  originalLanguage?: string
}

export interface GlossaryEntry {
  id: string
  term: string
  definition: string
  aliases: string[]
  example?: string
  tags: string[]
  status: 'DRAFT' | 'SUBMITTED_FOR_RELEASE' | 'APPROVED' | 'REJECTED' | 'ARCHIVED'
  moduleId?: string | null
  authorId: string
  currentVersionId?: string
  statusComment?: string
  module?: { id: string; name: string }
  author?: { id: string; name: string }
  currentVersion?: { id: string; versionNumber: number }
}

export interface GlossaryVersion {
  id: string
  versionNumber: number
  term: string
  definition: string
  example?: string
  tags: string[]
  status: string
  changeComment?: string
  createdAt: string
  author?: { id: string; name: string }
  aiReview?: { id: string; status: string; result: any }
}

export const useGlossaryStore = defineStore('glossary', () => {
  const entries = ref<GlossaryEntry[]>([])
  const terms = ref<GlossaryTerm[]>([])
  const current = ref<GlossaryEntry | null>(null)
  const versions = ref<GlossaryVersion[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function fetchEntries(params?: Record<string, string | number | undefined>) {
    loading.value = true
    try {
      const q = params ? new URLSearchParams() as any : ''
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
        }
      }
      const path = params ? `/glossary?${q.toString()}` : '/glossary'
      const data = await api.get(path)
      entries.value = data.entries
      total.value = data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchEntry(id: string) {
    const data = await api.get(`/glossary/${id}`)
    current.value = data.entry
  }

  async function fetchTerms() {
    const data = await api.get('/glossary/terms')
    terms.value = data.terms
  }

  async function createEntry(payload: Partial<GlossaryEntry>) {
    const data = await api.post('/glossary', payload)
    return data.entry
  }

  async function updateEntry(id: string, payload: Partial<GlossaryEntry>) {
    const data = await api.patch(`/glossary/${id}`, payload)
    current.value = data.entry
    return data.entry
  }

  async function deleteEntry(id: string) {
    await api.delete(`/glossary/${id}`)
  }

  async function submitEntry(id: string, body?: any) {
    const data = await api.post(`/glossary/${id}/submit`, body || {})
    current.value = data.entry
  }

  async function approveEntry(id: string, statusComment?: string) {
    const data = await api.post(`/glossary/${id}/approve`, { statusComment })
    current.value = data.entry
  }

  async function rejectEntry(id: string, statusComment: string) {
    const data = await api.post(`/glossary/${id}/reject`, { statusComment })
    current.value = data.entry
  }

  async function reopenEntry(id: string, statusComment?: string) {
    const data = await api.post(`/glossary/${id}/reopen`, { statusComment })
    current.value = data.entry
  }

  async function fetchVersions(id: string) {
    const data = await api.get(`/glossary/${id}/versions`)
    versions.value = data.versions
  }

  async function review(id: string) {
    const data = await api.post(`/glossary/${id}/ai-review`, {})
    return data.aiReview
  }

  return {
    entries, terms, current, versions, total, loading,
    fetchEntries, fetchTerms, fetchEntry, createEntry, updateEntry, deleteEntry,
    submitEntry, approveEntry, rejectEntry, reopenEntry, fetchVersions, review,
  }
})
