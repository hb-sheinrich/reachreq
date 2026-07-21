<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '@/services/api'
import AutoComplete from 'primevue/autocomplete'

const props = defineProps<{
  modelValue: string[]
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const router = useRouter()
const { t } = useI18n()

const baseSuggestions = ref<{ name: string }[]>([])
const currentQuery = ref('')
const autoCompleteRef = ref<InstanceType<typeof AutoComplete> | null>(null)

const selected = ref<{ name: string }[]>([])

function namesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((name, i) => name === b[i])
}

watch(
  () => props.modelValue,
  (tags) => {
    const normalized = tags || []
    const currentNames = selected.value.map((s) => s.name)
    if (namesEqual(currentNames, normalized)) return
    selected.value = normalized.map((name) => ({ name }))
  },
  { immediate: true },
)

watch(
  selected,
  (value) => {
    const emitted = value.map((v) => v.name)
    if (namesEqual(emitted, props.modelValue || [])) return
    emit('update:modelValue', emitted)
  },
  { deep: true },
)

const suggestions = computed(() => {
  const query = currentQuery.value.trim()
  const base = baseSuggestions.value.filter((tag) =>
    !selected.value.some((s) => s.name === tag.name),
  )
  if (!query) return base
  const exists = base.some((tag) => tag.name.toLowerCase() === query.toLowerCase())
  const isSelected = selected.value.some((s) => s.name.toLowerCase() === query.toLowerCase())
  if (!exists && !isSelected) {
    return [{ name: query, create: true as any }, ...base]
  }
  return base
})

async function search(event: { query: string }) {
  currentQuery.value = event.query || ''
  if (!event.query) {
    baseSuggestions.value = []
    return
  }
  try {
    const data = await api.get(`/tags?search=${encodeURIComponent(event.query)}`)
    baseSuggestions.value = (data.tags || []).map((tag: { name: string }) => ({ name: tag.name }))
  } catch {
    baseSuggestions.value = []
  }
}

function addTag(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  if (selected.value.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return
  selected.value = [...selected.value, { name: trimmed }]
}

function clearInput() {
  const ac = autoCompleteRef.value as any
  const inputEl = ac?.$refs?.focusInput as HTMLInputElement | undefined
  if (inputEl) inputEl.value = ''
  currentQuery.value = ''
}

function onKeyDown(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key === ',' || event.key === 'Enter') {
    const inputEl = event.target as HTMLInputElement | null
    const value = inputEl?.value ?? currentQuery.value
    const trimmed = value.trim()
    if (trimmed) {
      if (event.key === ',' || !suggestions.value.some((s: any) => !s.create && s.name.toLowerCase() === trimmed.toLowerCase())) {
        event.preventDefault()
        event.stopImmediatePropagation()
        addTag(trimmed)
        clearInput()
      }
    }
  }
}

function onTagClick(name: string) {
  if (props.disabled) return
  router.push({ name: 'Requirements', query: { tags: name } })
}

let inputEl: HTMLInputElement | undefined

onMounted(async () => {
  await nextTick()
  const ac = autoCompleteRef.value as any
  inputEl = ac?.$refs?.focusInput as HTMLInputElement | undefined
  if (inputEl) {
    inputEl.addEventListener('keydown', onKeyDown, true)
  }
})

onUnmounted(() => {
  if (inputEl) {
    inputEl.removeEventListener('keydown', onKeyDown, true)
  }
})
</script>

<template>
  <AutoComplete
    ref="autoCompleteRef"
    v-model="selected"
    :suggestions="suggestions"
    :disabled="disabled"
    :placeholder="placeholder || t('tag.addPlaceholder')"
    option-label="name"
    multiple
    :dropdown="true"
    :auto-option-focus="true"
    :force-selection="false"
    class="w-full"
    pt:root="w-full"
    @complete="search"
  >
    <template #chip="{ value, removeCallback }">
      <button
        type="button"
        class="inline-flex items-center gap-1 px-2 py-1 rounded-pill bg-surface-2 text-text-muted text-sm font-mono hover:bg-border transition-colors focus:outline-none focus:ring-2 focus:ring-focus"
        @click="onTagClick(value.name)"
      >
        {{ value.name }}
        <span
          class="pi pi-times text-xs cursor-pointer hover:text-text"
          @click.stop="removeCallback($event)"
        />
      </button>
    </template>
    <template #option="{ option }">
      <span v-if="option.create" class="text-sm font-medium text-text">
        {{ t('tag.createOption', { name: option.name }) }}
      </span>
      <span v-else class="text-sm font-mono">{{ option.name }}</span>
    </template>
  </AutoComplete>
</template>
