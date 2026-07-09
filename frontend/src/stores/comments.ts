import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'

export interface Comment {
  id: string
  requirementId?: string
  glossaryEntryId?: string
  versionId?: string
  textAnchor?: any
  content: string
  authorId: string
  status: 'OPEN' | 'RESOLVED'
  parentId?: string
  createdAt: string
  updatedAt: string
  author?: { id: string; name: string }
  replies?: Comment[]
}

export const useCommentsStore = defineStore('comments', () => {
  const comments = ref<Comment[]>([])
  const loading = ref(false)

  async function fetchComments(requirementId?: string, glossaryEntryId?: string) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      if (requirementId) params.set('requirementId', requirementId)
      if (glossaryEntryId) params.set('glossaryEntryId', glossaryEntryId)
      const path = `/comments?${params.toString()}`
      const data = await api.get(path)
      comments.value = data.comments
    } finally {
      loading.value = false
    }
  }

  async function createComment(payload: Partial<Comment>) {
    const data = await api.post('/comments', payload)
    await fetchComments(payload.requirementId, payload.glossaryEntryId)
    return data.comment
  }

  async function resolveComment(id: string) {
    const data = await api.patch(`/comments/${id}`, { status: 'RESOLVED' })
    const c = comments.value.find((x) => x.id === id)
    if (c) c.status = 'RESOLVED'
    return data.comment
  }

  async function deleteComment(id: string) {
    await api.delete(`/comments/${id}`)
    comments.value = comments.value.filter((c) => c.id !== id)
  }

  return { comments, loading, fetchComments, createComment, resolveComment, deleteComment }
})
