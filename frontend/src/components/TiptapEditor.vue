<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { Extension, type CommandProps } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Popover from 'primevue/popover'
import type { GlossaryTerm } from '@/stores/glossary'
import { useCaseMessages } from '@/locales/useCase'

const props = defineProps<{
  modelValue?: string
  editable?: boolean
  terms?: GlossaryTerm[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const router = useRouter()
const { t } = useI18n({ messages: useCaseMessages })

const definedPopover = ref<InstanceType<typeof Popover> | null>(null)
const definedTerm = ref<{ id?: string; term?: string; definition?: string }>({})
const lastEmitted = ref<string>('')

const glossaryHighlightPluginKey = new PluginKey('glossaryHighlight')

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function plainTextToTiptapHtml(value: string): string {
  if (!value) return '<p></p>'
  const paragraphs = value.split(/\n\n/)
  const filtered = paragraphs.filter((p, i) => p !== '' || i !== paragraphs.length - 1)
  if (filtered.length === 0) return '<p></p>'
  return filtered
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

type TermEntry =
  | { type: 'defined'; id: string; term: string; definition?: string; text: string }
  | { type: 'alias'; alias: string; preferred: string; text: string }

interface GlossaryPattern {
  regex: RegExp | null
  termMap: Map<string, TermEntry>
}

function buildPattern(terms: GlossaryTerm[]): GlossaryPattern {
  const seen = new Set<string>()
  const entries: TermEntry[] = []

  for (const term of terms) {
    if (!term?.term?.trim()) continue
    const text = term.term.trim()
    if (seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())
    entries.push({ type: 'defined', id: term.id, term: term.term, definition: term.definition, text })

    for (const alias of term.aliases || []) {
      if (!alias?.trim()) continue
      const aliasText = alias.trim()
      if (aliasText.toLowerCase() === text.toLowerCase()) continue
      if (seen.has(aliasText.toLowerCase())) continue
      seen.add(aliasText.toLowerCase())
      entries.push({ type: 'alias', alias: aliasText, preferred: term.term, text: aliasText })
    }
  }

  entries.sort((a, b) => {
    if (b.text.length !== a.text.length) return b.text.length - a.text.length
    if (a.type === 'defined' && b.type === 'alias') return -1
    if (a.type === 'alias' && b.type === 'defined') return 1
    return 0
  })

  const termMap = new Map<string, TermEntry>()
  const parts: string[] = []
  for (const entry of entries) {
    const key = entry.text.toLowerCase()
    if (termMap.has(key)) {
      const existing = termMap.get(key)!
      if (existing.type === 'defined' || entry.type !== 'defined') continue
    }
    termMap.set(key, entry)
    parts.push(escapeRegex(entry.text))
  }

  if (parts.length === 0) return { regex: null, termMap }

  const regex = new RegExp(`\\b(?:${parts.join('|')})\\b`, 'gi')
  return { regex, termMap }
}

function buildDecorations(doc: any, pattern: GlossaryPattern): Decoration[] {
  const { regex, termMap } = pattern
  if (!regex || !termMap || termMap.size === 0) return []

  const decorations: Decoration[] = []

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return
    const text = node.text
    const covered: { from: number; to: number }[] = []

    for (const match of text.matchAll(regex)) {
      if (match.index === undefined) continue
      const from = pos + match.index
      const to = from + match[0].length
      if (to === from) continue
      if (covered.some((r) => from < r.to && to > r.from)) continue
      covered.push({ from, to })

      const entry = termMap.get(match[0].toLowerCase())
      if (!entry) continue

      if (entry.type === 'defined') {
        decorations.push(
          Decoration.inline(from, to, {
            nodeName: 'span',
            class: 'glossary-defined',
            'data-glossary-id': entry.id,
            'data-glossary-term': entry.term,
            'data-glossary-definition': entry.definition || '',
            role: 'button',
            'aria-haspopup': 'dialog',
            'aria-expanded': 'false',
            'aria-describedby': 'glossary-description',
            tabindex: '0',
          }),
        )
      } else {
        decorations.push(
          Decoration.inline(from, to, {
            nodeName: 'span',
            class: 'glossary-alias',
            'data-glossary-alias': entry.alias,
            'data-glossary-preferred': entry.preferred,
            title: t('useCase.aliasTooltip', { term: entry.preferred }),
          }),
        )
      }
    }
  })

  return decorations
}

const GlossaryHighlight = Extension.create({
  name: 'glossaryHighlight',
  addOptions() {
    return {
      terms: [] as GlossaryTerm[],
    }
  },
  addCommands() {
    const key = glossaryHighlightPluginKey
    return {
      setGlossaryTerms: (terms: GlossaryTerm[]) => ({ tr, dispatch }: CommandProps) => {
        if (dispatch) {
          tr.setMeta(key, { terms, pattern: buildPattern(terms) })
          dispatch(tr)
        }
        return true
      },
    } as any
  },
  addProseMirrorPlugins() {
    const key = glossaryHighlightPluginKey
    return [
      new Plugin({
        key,
        state: {
          init: () => {
            const terms = this.options.terms as GlossaryTerm[]
            return { terms, pattern: buildPattern(terms) }
          },
          apply: (tr, value) => {
            const meta = tr.getMeta(key)
            if (meta) return { ...value, terms: meta.terms || value.terms, pattern: meta.pattern || value.pattern }
            return value
          },
        },
        props: {
          decorations: function (state) {
            const pluginState = this.getState(state) as { pattern: GlossaryPattern } | undefined
            const pattern = pluginState?.pattern || { regex: null, termMap: new Map() }
            return DecorationSet.create(state.doc, buildDecorations(state.doc, pattern))
          },
        },
      }),
    ]
  },
})

const editorClasses = computed(() => [
  'editor-content',
  props.editable ? 'edit-mode' : 'view-mode',
])

function showPopover(event: Event, el: HTMLElement) {
  definedTerm.value = {
    id: el.dataset.glossaryId,
    term: el.dataset.glossaryTerm,
    definition: el.dataset.glossaryDefinition,
  }
  nextTick(() => {
    definedPopover.value?.show(event)
  })
}

function hidePopover(event?: FocusEvent | MouseEvent) {
  const related = event?.relatedTarget as HTMLElement | null
  if (!related?.closest('.glossary-defined, .glossary-popover')) {
    definedPopover.value?.hide()
  }
}

const editor = useEditor({
  content: plainTextToTiptapHtml(props.modelValue || ''),
  editable: props.editable,
  extensions: [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      code: false,
      bold: false,
      italic: false,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
    }),
    Placeholder.configure({
      placeholder: props.placeholder || '',
      emptyEditorClass: 'is-editor-empty',
      showOnlyWhenEditable: true,
    }),
    GlossaryHighlight.configure({ terms: props.terms || [] }),
  ],
  editorProps: {
    handleDOMEvents: {
      mouseover: (view, event) => {
        const target = event.target as HTMLElement | null
        const el = target?.closest('.glossary-defined') as HTMLElement | null
        if (el) showPopover(event as Event, el)
        return false
      },
      mouseout: (view, event) => {
        hidePopover(event as MouseEvent)
        return false
      },
      focusin: (view, event) => {
        const target = event.target as HTMLElement | null
        const el = target?.closest('.glossary-defined') as HTMLElement | null
        if (el) showPopover(event as Event, el)
        return false
      },
      focusout: (view, event) => {
        hidePopover(event as FocusEvent)
        return false
      },
      click: (view, event) => {
        const target = event.target as HTMLElement | null
        const el = target?.closest('.glossary-defined') as HTMLElement | null
        if (el && !view.editable) {
          const id = el.dataset.glossaryId
          if (id) {
            event.preventDefault()
            router.push(`/glossary/${id}`)
            return true
          }
        }
        return false
      },
    },
  },
  onUpdate: ({ editor }) => {
    lastEmitted.value = editor.getText()
    emit('update:modelValue', lastEmitted.value)
  },
})

watch(
  () => props.modelValue,
  (newValue) => {
    const editorInstance = editor.value
    if (!editorInstance) return
    const next = newValue ?? ''
    if (next === lastEmitted.value) return
    const currentText = editorInstance.getText()
    if (next === currentText) {
      lastEmitted.value = currentText
      return
    }
    editorInstance.commands.setContent(plainTextToTiptapHtml(next), { emitUpdate: false })
    lastEmitted.value = editorInstance.getText()
  },
)

watch(
  () => props.editable,
  (editable) => {
    editor.value?.setEditable(!!editable)
  },
)

watch(
  () => props.terms,
  (terms) => {
    if (!editor.value) return
    ;(editor.value.commands as any).setGlossaryTerms(terms || [])
  },
)

</script>

<template>
  <div>
    <editor-content :editor="editor" :class="editorClasses" />
    <span id="glossary-description" class="sr-only">{{ definedTerm.definition }}</span>
    <Popover ref="definedPopover" class="glossary-popover">
      <template v-if="definedTerm.term">
        <div class="p-3 max-w-xs">
          <div class="font-display font-semibold text-text mb-1">{{ definedTerm.term }}</div>
          <div class="text-sm text-text-muted mb-2 whitespace-pre-wrap">{{ definedTerm.definition }}</div>
          <router-link
            v-if="definedTerm.id"
            :to="`/glossary/${definedTerm.id}`"
            class="text-sm text-link hover:underline"
          >
            {{ t('useCase.glossaryPopover.link') }}
          </router-link>
        </div>
      </template>
    </Popover>
  </div>
</template>
