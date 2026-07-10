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
import Popover from 'primevue/popover'
import type { GlossaryTerm } from '@/stores/glossary'

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

const definedPopover = ref<InstanceType<typeof Popover> | null>(null)
const definedTerm = ref<{ id?: string; term?: string; definition?: string }>({})

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

function buildDecorations(doc: any, terms: GlossaryTerm[]) {
  const decorations: Decoration[] = []
  const definedSet = new Set<{ from: number; to: number }>()

  const termPatterns = terms
    .flatMap((term) => {
      const result: {
        regex: RegExp
        type: 'defined' | 'alias'
        id?: string
        term?: string
        definition?: string
        alias?: string
        preferred?: string
        length: number
      }[] = []
      result.push({
        regex: new RegExp(`\\b${escapeRegex(term.term)}\\b`, 'gi'),
        type: 'defined',
        id: term.id,
        term: term.term,
        definition: term.definition,
        length: term.term.length,
      })
      for (const alias of term.aliases || []) {
        if (!alias || alias.toLowerCase() === term.term.toLowerCase()) continue
        result.push({
          regex: new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi'),
          type: 'alias',
          alias,
          preferred: term.term,
          length: alias.length,
        })
      }
      return result
    })
    .sort((a, b) => b.length - a.length)

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return
    const text = node.text
    const covered: { from: number; to: number }[] = []

    function isCovered(from: number, to: number) {
      return covered.some((r) => from < r.to && to > r.from)
    }

    function addCovered(from: number, to: number) {
      covered.push({ from, to })
    }

    for (const pattern of termPatterns) {
      for (const match of text.matchAll(pattern.regex)) {
        if (match.index === undefined) continue
        const from = pos + match.index
        const to = from + match[0].length
        if (isCovered(from, to)) continue
        addCovered(from, to)

        if (pattern.type === 'defined') {
          decorations.push(
            Decoration.inline(from, to, {
              nodeName: 'span',
              class: 'glossary-defined',
              'data-glossary-id': pattern.id,
              'data-glossary-term': pattern.term,
              'data-glossary-definition': pattern.definition || '',
              tabindex: '0',
            }),
          )
        } else if (pattern.type === 'alias' && pattern.preferred && pattern.alias) {
          decorations.push(
            Decoration.inline(from, to, {
              nodeName: 'span',
              class: 'glossary-alias',
              title: `Bitte durch den korrekten Glossarbegriff '${pattern.preferred}' ersetzen.`,
            }),
          )
        }
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
          tr.setMeta(key, { terms })
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
          init: () => ({ terms: this.options.terms as GlossaryTerm[] }),
          apply: (tr, value) => {
            const meta = tr.getMeta(key)
            if (meta) return { ...value, ...meta }
            return value
          },
        },
        props: {
          decorations: function (state) {
            const pluginState = this.getState(state) as { terms: GlossaryTerm[] } | undefined
            const terms = pluginState?.terms || []
            return DecorationSet.create(state.doc, buildDecorations(state.doc, terms))
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
    }),
    GlossaryHighlight.configure({ terms: props.terms || [] }),
  ],
  editorProps: {
    handleDOMEvents: {
      mouseenter: (view, event) => {
        const target = event.target as HTMLElement | null
        const el = target?.closest('.glossary-defined') as HTMLElement | null
        if (el) {
          definedTerm.value = {
            id: el.dataset.glossaryId,
            term: el.dataset.glossaryTerm,
            definition: el.dataset.glossaryDefinition,
          }
          nextTick(() => {
            definedPopover.value?.show(event as Event)
          })
        }
        return false
      },
      mouseleave: (view, event) => {
        const related = event.relatedTarget as HTMLElement | null
        if (!related?.closest('.glossary-defined')) {
          definedPopover.value?.hide()
        }
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
    emit('update:modelValue', editor.getText())
  },
})

watch(
  () => props.modelValue,
  (newValue) => {
    const editorInstance = editor.value
    if (!editorInstance) return
    if (newValue === editorInstance.getText()) return
    editorInstance.commands.setContent(plainTextToTiptapHtml(newValue || ''), { emitUpdate: false })
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
    ;(editor.value?.commands as any).setGlossaryTerms(terms || [])
  },
  { deep: true },
)

</script>

<template>
  <div>
    <editor-content :editor="editor" :class="editorClasses" />
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
            Zum Glossar
          </router-link>
        </div>
      </template>
    </Popover>
  </div>
</template>
