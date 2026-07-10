import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'

export interface RequirementReviewer {
  id: string
  name: string
}

export interface RequirementVersion {
  id: string
  versionNumber: number
  title: string
  description?: string
  context?: string
  acceptanceCriteria: string[]
  classification: string
  moduleId: string
  source?: string
  changeComment?: string
  changeType?: string
  status?: string
  createdAt: string
  author?: { id: string; name: string; email?: string }
  aiReview?: { id: string; status: string; result: any }
  currentVersion?: boolean
  diff?: Record<string, { from: unknown; to: unknown }> | null
}

export interface Requirement {
  id: string
  humanReadableId: string
  moduleId: string
  title: string
  description?: string
  context?: string
  acceptanceCriteria: string[]
  classification: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE' | 'WONT_HAVE'
  status: 'DRAFT' | 'IN_REVIEW' | 'SUBMITTED_FOR_RELEASE' | 'APPROVED' | 'REJECTED' | 'POSTPONED'
  source?: string
  authorId: string
  currentVersionId?: string
  frozenById?: string
  frozenAt?: string
  editVersion: number
  statusComment?: string
  module?: { id: string; name: string; code: string }
  author?: { id: string; name: string }
  frozenBy?: { id: string; name: string }
  currentVersion?: { id: string; versionNumber: number }
  _count?: { comments: number }

  // Use-Case 2.0 fields
  category?: string
  goal?: string
  precondition?: string
  postcondition?: string
  mainFlow: string[]
  alternativeFlows: { id?: string; afterStep?: string; branchAt?: string; steps: string[] }[]
  technicalAppendix?: Record<string, unknown>
  originalLanguage?: 'de' | 'en'

  // Reviews
  reviewedByCe: boolean
  reviewedAtCe?: string
  reviewerCe?: RequirementReviewer | null
  reviewedByAscShe: boolean
  reviewedAtAscShe?: string
  reviewerAscShe?: RequirementReviewer | null

  // Jira
  jiraIssueKey?: string
  jiraIssueUrl?: string
  jiraIssueCreatedAt?: string

  tags: string[]
}

export interface RequirementLink {
  id: string
  fromId: string
  toId: string
  type: string
  toRequirement?: { id: string; humanReadableId: string; title: string }
  fromRequirement?: { id: string; humanReadableId: string; title: string }
}

export const useRequirementsStore = defineStore('requirements', () => {
  const requirements = ref<Requirement[]>([])
  const current = ref<Requirement | null>(null)
  const versions = ref<RequirementVersion[]>([])
  const links = ref<{ from: RequirementLink[]; to: RequirementLink[] }>({ from: [], to: [] })
  const total = ref(0)
  const loading = ref(false)

  async function fetchRequirements(params?: Record<string, string | number | undefined>) {
    loading.value = true
    try {
      const q = params ? new URLSearchParams() as any : ''
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
        }
      }
      const path = params ? `/requirements?${q.toString()}` : '/requirements'
      const data = await api.get(path)
      requirements.value = data.requirements
      total.value = data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchRequirement(id: string, lang?: string) {
    const path = lang ? `/requirements/${id}?lang=${lang}` : `/requirements/${id}`
    const data = await api.get(path)
    current.value = data.requirement
  }

  async function createRequirement(payload: Partial<Requirement>) {
    const data = await api.post('/requirements', payload)
    return data.requirement
  }

  async function updateRequirement(id: string, payload: Partial<Requirement>, editVersion: number) {
    const data = await api.patch(`/requirements/${id}`, { ...payload, editVersion })
    current.value = data.requirement
    return data.requirement
  }

  async function submitRequirement(id: string, body?: any) {
    const data = await api.post(`/requirements/${id}/submit`, body || {})
    current.value = data.requirement
  }

  async function approveRequirement(id: string, statusComment?: string) {
    const data = await api.post(`/requirements/${id}/approve`, { statusComment })
    current.value = data.requirement
  }

  async function rejectRequirement(id: string, statusComment: string) {
    const data = await api.post(`/requirements/${id}/reject`, { statusComment })
    current.value = data.requirement
  }

  async function reopenRequirement(id: string, statusComment?: string) {
    const data = await api.post(`/requirements/${id}/reopen`, { statusComment })
    current.value = data.requirement
  }

  async function startEdit(id: string) {
    const data = await api.post(`/requirements/${id}/edit`, {})
    current.value = data.requirement
  }

  async function rollbackRequirement(id: string, versionId: string) {
    const data = await api.post(`/requirements/${id}/rollback`, { versionId })
    current.value = data.requirement
  }

  async function fetchVersions(id: string) {
    const data = await api.get(`/requirements/${id}/versions`)
    versions.value = data.versions
  }

  async function setReview(id: string, body: { reviewedByCe?: boolean; reviewedByAscShe?: boolean }) {
    const data = await api.post(`/requirements/${id}/reviews`, body)
    current.value = data.requirement
  }

  async function createJiraTicket(id: string) {
    const data = await api.post(`/requirements/${id}/jira-ticket`, {})
    current.value = data.requirement
    return data
  }

  async function translateRequirement(id: string, targetLanguage: 'de' | 'en') {
    const data = await api.post(`/requirements/${id}/translate`, { targetLanguage })
    return data.translation
  }

  async function importUseCase(id: string, payload: any) {
    const data = await api.post(`/requirements/${id}/usecase/import`, payload)
    current.value = data.requirement
    return data.requirement
  }

  async function fetchLinks(id: string) {
    const data = await api.get(`/requirements/${id}/links`)
    links.value = data
  }

  async function createLink(id: string, toId: string, type: string) {
    await api.post(`/requirements/${id}/links`, { toId, type })
    await fetchLinks(id)
  }

  async function deleteLink(linkId: string) {
    const reqId = current.value?.id
    if (!reqId) return
    await api.delete(`/requirements/${reqId}/links/${linkId}`)
    await fetchLinks(reqId)
  }

  async function fetchGlossaryLinks(id: string) {
    return await api.get(`/requirements/${id}/glossary-links`)
  }

  async function setGlossaryLinks(id: string, glossaryEntryIds: string[]) {
    await api.post(`/requirements/${id}/glossary-links`, { glossaryEntryIds })
  }

  async function review(id: string) {
    const data = await api.post(`/requirements/${id}/ai-review`, {})
    return data.aiReview
  }

  return {
    requirements, current, versions, links, total, loading,
    fetchRequirements, fetchRequirement, createRequirement, updateRequirement,
    submitRequirement, approveRequirement, rejectRequirement, reopenRequirement,
    startEdit, rollbackRequirement, fetchVersions, setReview, createJiraTicket,
    translateRequirement, importUseCase, fetchLinks, createLink, deleteLink,
    fetchGlossaryLinks, setGlossaryLinks, review,
  }
})
