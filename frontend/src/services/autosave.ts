import { ref, watch, onUnmounted } from 'vue'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

export function useAutosave<T extends Record<string, unknown>>(
  id: string,
  getter: () => T,
  saver: (data: T) => Promise<unknown>
) {
  const status = ref<SaveStatus>('idle')
  const statusMessage = ref('')
  let timer: number | null = null
  const DEBOUNCE_MS = 2000

  function loadDraft(): T | null {
    try {
      const key = `draft:${id}`
      const raw = localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  function saveDraft(data: T) {
    try {
      localStorage.setItem(`draft:${id}`, JSON.stringify(data))
    } catch {
      // ignore
    }
  }

  function clearDraft() {
    localStorage.removeItem(`draft:${id}`)
  }

  async function save() {
    const data = getter()
    status.value = 'saving'
    statusMessage.value = 'Speichert...'
    try {
      await saver(data)
      status.value = 'saved'
      statusMessage.value = 'Gespeichert'
      clearDraft()
    } catch (err: any) {
      if (err.status === 409) {
        status.value = 'conflict'
        statusMessage.value = 'Konflikt: Andere Bearbeitung'
      } else {
        status.value = 'error'
        statusMessage.value = err.message || 'Fehler'
      }
      saveDraft(data)
    }
  }

  function trigger() {
    status.value = 'idle'
    statusMessage.value = ''
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => save(), DEBOUNCE_MS)
  }

  function forceSave() {
    if (timer) window.clearTimeout(timer)
    return save()
  }

  function setupWatch(source: any) {
    watch(source, trigger, { deep: true })
    const beforeUnload = () => {
      if (status.value === 'saving' || status.value === 'idle') {
        saveDraft(getter())
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    onUnmounted(() => {
      window.removeEventListener('beforeunload', beforeUnload)
      if (timer) window.clearTimeout(timer)
    })
  }

  return { status, statusMessage, save, forceSave, loadDraft, saveDraft, clearDraft, setupWatch }
}
