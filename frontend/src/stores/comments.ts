import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'

export interface Mention {
  user: { id: string; name: string; email: string }
}

export interface TextAnchor {
  field: string
  text: string
  start: number
  end: number
}

export interface Comment {
  id: string
  requirementId?: string
  glossaryEntryId?: string
  versionId?: string
  textAnchor?: TextAnchor | null
  content: string
  authorId: string
  status: 'OPEN' | 'RESOLVED'
  parentId?: string
  createdAt: string
  updatedAt: string
  author?: { id: string; name: string }
  replies?: Comment[]
  mentions?: Mention[]
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

  function updateCommentInTree(list: Comment[], id: string, patch: Partial<Comment>): boolean {
    for (const c of list) {
      if (c.id === id) {
        Object.assign(c, patch)
        return true
      }
      if (c.replies?.length && updateCommentInTree(c.replies, id, patch)) return true
    }
    return false
  }

  async function resolveComment(id: string) {
    const data = await api.patch(`/comments/${id}`, { status: 'RESOLVED' })
    updateCommentInTree(comments.value, id, data.comment)
    return data.comment
  }

  async function reopenComment(id: string) {
    const data = await api.patch(`/comments/${id}`, { status: 'OPEN' })
    updateCommentInTree(comments.value, id, data.comment)
    return data.comment
  }

  function removeCommentFromTree(list: Comment[], id: string): Comment[] {
    return list.filter((c) => {
      if (c.id === id) return false
      if (c.replies?.length) {
        c.replies = removeCommentFromTree(c.replies, id)
      }
      return true
    })
  }

  async function deleteComment(id: string) {
    await api.delete(`/comments/${id}`)
    comments.value = removeCommentFromTree(comments.value, id)
  }

  return { comments, loading, fetchComments, createComment, resolveComment, reopenComment, deleteComment }
})
