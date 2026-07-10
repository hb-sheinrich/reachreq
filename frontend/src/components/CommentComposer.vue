<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '@/services/api'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'

export interface CommentComposerPayload {
  content: string
  textAnchor?: { field: string; text: string; start: number; end: number } | null
  mentions?: string[]
}

const props = defineProps<{
  placeholder?: string
  submitLabel?: string
  textAnchor?: { field: string; text: string; start: number; end: number } | null
  initialContent?: string
  replyingTo?: { id: string; authorName?: string; content?: string } | null
}>()

const emit = defineEmits<{
  (e: 'submit', payload: CommentComposerPayload): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()
const content = ref(props.initialContent || '')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const mentionQuery = ref('')
const mentionSuggestions = ref<{ id: string; name: string; email: string }[]>([])
const mentionIndex = ref(-1)
const mentionRange = ref<{ start: number; end: number } | null>(null)
const isLoadingMentions = ref(false)

const showMentions = computed(
  () => mentionQuery.value.length > 0 && mentionSuggestions.value.length > 0,
)

watch(
  () => props.initialContent,
  (value) => {
    if (value && value !== content.value) content.value = value
  },
)

function onInput() {
  checkMention()
}

function onKeydown(event: KeyboardEvent) {
  if (!showMentions.value) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      submit()
    }
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    mentionIndex.value = (mentionIndex.value + 1) % mentionSuggestions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    mentionIndex.value =
      (mentionIndex.value - 1 + mentionSuggestions.value.length) % mentionSuggestions.value.length
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    if (mentionIndex.value >= 0) selectMention(mentionIndex.value)
  } else if (event.key === 'Escape') {
    mentionQuery.value = ''
    mentionSuggestions.value = []
  }
}

async function checkMention() {
  const el = textareaRef.value
  if (!el) return
  const cursor = el.selectionStart
  const text = content.value
  const before = text.slice(0, cursor)
  const match = before.match(/@([^\s@]*)$/)
  if (!match) {
    mentionQuery.value = ''
    mentionSuggestions.value = []
    return
  }
  const query = match[1]
  mentionQuery.value = query
  mentionIndex.value = -1
  mentionRange.value = { start: cursor - query.length - 1, end: cursor }
  await searchUsers(query)
}

async function searchUsers(query: string) {
  isLoadingMentions.value = true
  try {
    const data = await api.get(`/users?search=${encodeURIComponent(query)}`)
    mentionSuggestions.value = (data.users || []).slice(0, 5)
  } catch {
    mentionSuggestions.value = []
  } finally {
    isLoadingMentions.value = false
  }
}

function selectMention(index: number) {
  const user = mentionSuggestions.value[index]
  if (!user || !textareaRef.value || !mentionRange.value) return
  const el = textareaRef.value
  const before = content.value.slice(0, mentionRange.value.start)
  const after = content.value.slice(mentionRange.value.end)
  const insert = `@${user.name} `
  content.value = before + insert + after
  const newCursor = before.length + insert.length
  nextTick(() => {
    el.setSelectionRange(newCursor, newCursor)
    el.focus()
  })
  mentionQuery.value = ''
  mentionSuggestions.value = []
  mentionRange.value = null
}

function submit() {
  const trimmed = content.value.trim()
  if (!trimmed) return
  const payload: CommentComposerPayload = {
    content: trimmed,
    textAnchor: props.textAnchor,
    mentions: [],
  }
  emit('submit', payload)
  content.value = ''
  mentionQuery.value = ''
  mentionSuggestions.value = []
}

function cancel() {
  content.value = ''
  mentionQuery.value = ''
  mentionSuggestions.value = []
  emit('cancel')
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="replyingTo" class="flex items-center justify-between rounded-field bg-surface-2 px-3 py-2 text-sm text-text-muted">
      <span>{{ t('comment.replyingTo', { name: replyingTo.authorName || '' }) }}</span>
      <span class="italic">"{{ replyingTo.content }}"</span>
      <button type="button" class="text-text hover:text-text-muted" @click="cancel">×</button>
    </div>
    <div v-if="textAnchor" class="flex items-center gap-2 rounded-field bg-surface-2 px-3 py-2 text-sm text-text-muted">
      <span class="font-mono">{{ textAnchor.field }}</span>
      <span class="truncate">"{{ textAnchor.text }}"</span>
      <button type="button" class="text-text hover:text-text-muted" @click="cancel">×</button>
    </div>
    <div class="relative">
      <Textarea
        ref="textareaRef"
        v-model="content"
        rows="3"
        class="w-full"
        :placeholder="placeholder || t('comment.placeholder')"
        @input="onInput"
        @keydown="onKeydown"
      />
      <div
        v-if="showMentions"
        class="absolute z-10 mt-1 w-full max-w-xs rounded-field border border-border bg-surface shadow-lg"
      >
        <button
          v-for="(user, index) in mentionSuggestions"
          :key="user.id"
          type="button"
          class="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
          :class="{ 'bg-surface-2': index === mentionIndex }"
          @click="selectMention(index)"
        >
          <span class="font-medium">{{ user.name }}</span>
          <span class="text-text-muted ml-2">{{ user.email }}</span>
        </button>
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <Button v-if="replyingTo || textAnchor" :label="t('app.cancel')" text size="small" @click="cancel" />
      <Button :label="submitLabel || t('comment.submit')" icon="pi pi-send" size="small" @click="submit" />
    </div>
  </div>
</template>
