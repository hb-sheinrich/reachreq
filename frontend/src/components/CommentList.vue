<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCommentsStore, type Comment } from '@/stores/comments'
import { useAuthStore } from '@/stores/auth'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Card from 'primevue/card'

const props = defineProps<{
  requirementId?: string
  glossaryEntryId?: string
}>()

const store = useCommentsStore()
const auth = useAuthStore()
const newComment = ref('')
const replyTo = ref<string | null>(null)

onMounted(() => store.fetchComments(props.requirementId, props.glossaryEntryId))

async function post() {
  if (!newComment.value.trim()) return
  await store.createComment({
    content: newComment.value,
    requirementId: props.requirementId,
    glossaryEntryId: props.glossaryEntryId,
    parentId: replyTo.value || undefined,
  })
  newComment.value = ''
  replyTo.value = null
}

async function resolve(id: string) {
  await store.resolveComment(id)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <Card pt:root="bg-surface border border-border rounded-card shadow-sm">
    <template #title>
      <span class="font-display font-semibold text-h2">Kommentare</span>
    </template>
    <template #content>
      <div class="space-y-3">
        <div
          v-for="c in store.comments"
          :key="c.id"
          class="border border-border rounded-field p-3 bg-surface-2"
        >
          <div class="text-sm text-text-muted flex justify-between">
            <span>{{ c.author?.name || c.authorId }}</span>
            <span>{{ formatDate(c.createdAt) }}</span>
          </div>
          <div class="mt-1 text-text">{{ c.content }}</div>
          <div class="mt-2 flex gap-2">
            <Button v-if="c.status === 'OPEN'" label="Erledigt" size="small" text @click="resolve(c.id)" />
            <Button label="Antworten" size="small" text @click="replyTo = c.id" />
          </div>
        </div>
        <div class="flex gap-2">
          <Textarea
            v-model="newComment"
            rows="2"
            class="flex-1"
            placeholder="Kommentar schreiben"
            :aria-label="replyTo ? 'Antwort schreiben' : 'Kommentar schreiben'"
          />
          <Button icon="pi pi-send" :aria-label="replyTo ? 'Antwort senden' : 'Kommentar senden'" @click="post" />
        </div>
      </div>
    </template>
  </Card>
</template>
