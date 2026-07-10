<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCommentsStore, type Comment } from '@/stores/comments'
import Button from 'primevue/button'
import Card from 'primevue/card'
import CommentThread from './CommentThread.vue'
import CommentComposer, { type CommentComposerPayload } from './CommentComposer.vue'

const props = defineProps<{
  requirementId?: string
  glossaryEntryId?: string
  pendingAnchor?: { field: string; text: string; start: number; end: number } | null
}>()

const emit = defineEmits<{
  (e: 'update:pendingAnchor', value: null): void
  (e: 'jump', anchor: any): void
}>()

const { t } = useI18n()
const store = useCommentsStore()

function load() {
  store.fetchComments(props.requirementId, props.glossaryEntryId)
}

onMounted(load)

watch(() => [props.requirementId, props.glossaryEntryId], load, { immediate: true })

async function createTopLevel(payload: CommentComposerPayload) {
  await store.createComment({
    content: payload.content,
    requirementId: props.requirementId,
    glossaryEntryId: props.glossaryEntryId,
    textAnchor: payload.textAnchor,
  })
  emit('update:pendingAnchor', null)
}

async function onReply(payload: { content: string; parentId: string; textAnchor?: any }) {
  await store.createComment({
    content: payload.content,
    requirementId: props.requirementId,
    glossaryEntryId: props.glossaryEntryId,
    parentId: payload.parentId,
    textAnchor: payload.textAnchor,
  })
}

async function onResolve(id: string) {
  await store.resolveComment(id)
}

async function onReopen(id: string) {
  await store.reopenComment(id)
}

async function onDelete(id: string) {
  await store.deleteComment(id)
}

function onJump(anchor: any) {
  emit('jump', anchor)
}

function cancelAnchor() {
  emit('update:pendingAnchor', null)
}
</script>

<template>
  <Card pt:root="bg-surface border border-border rounded-card shadow-sm">
    <template #title>
      <span class="font-display font-semibold text-h2">{{ t('comment.title') }}</span>
    </template>
    <template #content>
      <div class="space-y-4">
        <CommentComposer
          :text-anchor="pendingAnchor"
          :placeholder="t('comment.placeholder')"
          :submit-label="t('comment.submit')"
          @submit="createTopLevel"
          @cancel="cancelAnchor"
        />
        <div v-if="!store.comments.length" class="text-text-subtle text-sm">
          {{ t('comment.empty') }}
        </div>
        <div v-else class="space-y-4">
          <CommentThread
            v-for="c in store.comments"
            :key="c.id"
            :comment="c"
            @reply="onReply"
            @resolve="onResolve"
            @reopen="onReopen"
            @delete="onDelete"
            @jump="onJump"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
