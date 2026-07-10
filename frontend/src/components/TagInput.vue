<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
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
const suggestions = ref<{ name: string }[]>([])
const selected = ref<{ name: string }[]>([])

watch(
  () => props.modelValue,
  (tags) => {
    const normalized = tags || []
    selected.value = normalized.map((name) => ({ name }))
  },
  { immediate: true },
)

watch(
  selected,
  (value) => {
    emit(
      'update:modelValue',
      value.map((v) => v.name),
    )
  },
  { deep: true },
)

async function search(event: { query: string }) {
  try {
    const data = await api.get(`/tags?search=${encodeURIComponent(event.query)}`)
    suggestions.value = (data.tags || []).filter(
      (tag: { name: string }) => !selected.value.some((s) => s.name === tag.name),
    )
  } catch {
    suggestions.value = []
  }
}

function onTagClick(name: string) {
  router.push({ name: 'Requirements', query: { tags: name } })
}
</script>

<template>
  <AutoComplete
    v-model="selected"
    :suggestions="suggestions"
    :disabled="disabled"
    :placeholder="placeholder || 'Tag hinzufügen...'"
    option-label="name"
    multiple
    class="w-full"
    pt:root="w-full"
    @complete="search"
  >
    <template #chip="{ value, removeCallback }">
      <button
        type="button"
        class="inline-flex items-center gap-1 px-2 py-1 rounded-pill bg-surface-2 text-text-muted text-sm font-mono hover:bg-border transition-colors focus:outline-none focus:ring-2 focus:ring-focus"
        :disabled="disabled"
        @click="onTagClick(value.name)"
      >
        {{ value.name }}
        <span
          class="pi pi-times text-xs cursor-pointer hover:text-text"
          @click.stop="!disabled && removeCallback($event)"
        />
      </button>
    </template>
    <template #option="{ option }">
      <span class="text-sm font-mono">{{ option.name }}</span>
    </template>
  </AutoComplete>
</template>
