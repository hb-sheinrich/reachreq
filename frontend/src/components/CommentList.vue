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
</script>

<template>
  <Card>
    <template #title>Kommentare</template>
    <template #content>
      <div class="space-y-3">
        <div v-for="c in store.comments" :key="c.id" class="border p-2 rounded">
          <div class="text-sm text-gray-600 flex justify-between">
            <span>{{ c.author?.name || c.authorId }}</span>
            <span>{{ new Date(c.createdAt).toLocaleString() }}</span>
          </div>
          <div class="mt-1">{{ c.content }}</div>
          <div class="mt-2 flex gap-2">
            <Button v-if="c.status === 'OPEN'" label="Erledigt" size="small" text @click="resolve(c.id)" />
            <Button label="Antworten" size="small" text @click="replyTo = c.id" />
          </div>
        </div>
        <div class="flex gap-2">
          <Textarea v-model="newComment" rows="2" class="flex-1" placeholder="Kommentar schreiben" />
          <Button icon="pi pi-send" @click="post" />
        </div>
      </div>
    </template>
  </Card>
</template>
