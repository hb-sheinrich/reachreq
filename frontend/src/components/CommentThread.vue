<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import type { Comment } from '@/stores/comments'
import Button from 'primevue/button'
import CommentComposer from './CommentComposer.vue'

const props = defineProps<{
  comment: Comment
  level?: number
}>()

const emit = defineEmits<{
  (e: 'reply', payload: { content: string; parentId: string; textAnchor?: any }): void
  (e: 'resolve', id: string): void
  (e: 'reopen', id: string): void
  (e: 'delete', id: string): void
  (e: 'jump', anchor: any): void
}>()

const { t } = useI18n()
const auth = useAuthStore()
const replyMode = ref(false)

const isResolved = computed(() => props.comment.status === 'RESOLVED')
const canManage = computed(() => props.comment.authorId === auth.user?.id || auth.isAdmin)

function formatDate(value: string) {
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function renderContent(content: string) {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/@([^\s@]+(?:\s[^\s@]+)?)/g, '<span class="text-link font-medium">@$1</span>')
    .replace(/\n/g, '<br>')
}

function onReply(payload: { content: string; textAnchor?: any }) {
  emit('reply', { content: payload.content, parentId: props.comment.id, textAnchor: payload.textAnchor })
  replyMode.value = false
}

function jump() {
  if (props.comment.textAnchor) emit('jump', props.comment.textAnchor)
}
</script>

<template>
  <div class="space-y-3" :class="{ 'opacity-60': isResolved }">
    <div class="border border-border rounded-field p-3 bg-surface-2" :class="level ? 'ml-8' : ''">
      <div class="flex items-start justify-between gap-2">
        <div class="text-sm text-text-muted">
          <span class="font-medium text-text">{{ comment.author?.name || comment.authorId }}</span>
          <span class="mx-1">·</span>
          <span>{{ formatDate(comment.createdAt) }}</span>
          <span v-if="isResolved" class="ml-2 px-2 py-0.5 rounded-pill bg-success text-success text-xs font-mono">
            {{ $t('comment.resolve') }}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <Button v-if="comment.textAnchor" icon="pi pi-link" text size="small" :title="$t('comment.anchorHint', { field: comment.textAnchor.field })" @click="jump" />
          <Button
            v-if="!isResolved"
            icon="pi pi-check"
            text
            size="small"
            :title="$t('comment.resolve')"
            @click="$emit('resolve', comment.id)"
          />
          <Button
            v-else
            icon="pi pi-replay"
            text
            size="small"
            :title="$t('comment.reopen')"
            @click="$emit('reopen', comment.id)"
          />
          <Button v-if="canManage" icon="pi pi-trash" text size="small" severity="danger" @click="$emit('delete', comment.id)" />
        </div>
      </div>
      <div class="mt-2 text-text whitespace-pre-wrap" v-html="renderContent(comment.content)" />
      <div class="mt-2 flex items-center gap-2">
        <Button :label="$t('comment.reply')" icon="pi pi-reply" text size="small" :class="{ 'text-link': replyMode }" @click="replyMode = !replyMode" />
      </div>
      <CommentComposer
        v-if="replyMode"
        class="mt-3"
        :replying-to="{ id: comment.id, authorName: comment.author?.name, content: comment.content }"
        :submit-label="$t('comment.reply')"
        @submit="onReply"
        @cancel="replyMode = false"
      />
    </div>
    <div v-if="comment.replies?.length" class="space-y-3">
      <CommentThread
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :level="(level || 0) + 1"
        @reply="$emit('reply', $event)"
        @resolve="$emit('resolve', $event)"
        @reopen="$emit('reopen', $event)"
        @delete="$emit('delete', $event)"
        @jump="$emit('jump', $event)"
      />
    </div>
  </div>
</template>
