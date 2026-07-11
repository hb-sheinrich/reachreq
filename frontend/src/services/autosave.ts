import { ref, watch, onUnmounted, type Ref } from 'vue'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

export function useAutosave<T extends Record<string, unknown>>(
  id: Ref<string>,
  getter: () => T,
  saver: (id: string, data: T) => Promise<unknown>
) {
  const status = ref<SaveStatus>('idle')
  const statusMessage = ref('')
  let timer: number | null = null
  let lastData: string | undefined = undefined
  const DEBOUNCE_MS = 2000

  function serialize(data: T): string {
    try {
      return JSON.stringify(data)
    } catch {
      return ''
    }
  }

  function draftKey(targetId: string) {
    return `draft:${targetId}`
  }

  function loadDraft(targetId?: string): T | null {
    try {
      const key = draftKey(targetId || id.value)
      const raw = localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  function saveDraft(targetId: string, data: T) {
    try {
      localStorage.setItem(draftKey(targetId), JSON.stringify(data))
    } catch {
      // ignore
    }
  }

  function clearDraft(targetId: string) {
    localStorage.removeItem(draftKey(targetId))
  }

  function setBaseline() {
    lastData = serialize(getter())
  }

  async function save(targetId?: string) {
    const currentId = targetId || id.value
    const data = getter()
    const serialized = serialize(data)
    if (lastData !== undefined && serialized === lastData) {
      status.value = 'saved'
      statusMessage.value = 'Gespeichert'
      clearDraft(currentId)
      return
    }

    status.value = 'saving'
    statusMessage.value = 'Speichert...'
    try {
      await saver(currentId, data)
      lastData = serialized
      status.value = 'saved'
      statusMessage.value = 'Gespeichert'
      clearDraft(currentId)
    } catch (err: any) {
      if (err.status === 409) {
        status.value = 'conflict'
        statusMessage.value = 'Konflikt: Andere Bearbeitung'
      } else {
        status.value = 'error'
        statusMessage.value = err.message || 'Fehler'
      }
      saveDraft(currentId, data)
    }
  }

  function trigger() {
    const targetId = id.value
    status.value = 'idle'
    statusMessage.value = ''
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => save(targetId), DEBOUNCE_MS)
  }

  function forceSave(overrideId?: string) {
    if (timer) window.clearTimeout(timer)
    return save(overrideId)
  }

  function setupWatch(source: any, ready?: Ref<boolean>) {
    const handleChange = () => {
      if (ready && !ready.value) {
        return
      }
      trigger()
    }
    watch(source, handleChange, { deep: true })
    if (ready) {
      watch(ready, (isReady) => {
        if (isReady) {
          setBaseline()
        }
      })
    }
    const beforeUnload = () => {
      if (status.value === 'saving' || status.value === 'idle') {
        saveDraft(id.value, getter())
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    onUnmounted(() => {
      window.removeEventListener('beforeunload', beforeUnload)
      if (timer) window.clearTimeout(timer)
      // best-effort flush of the pending save for the current id
      save(id.value)
    })
  }

  return { status, statusMessage, save, forceSave, loadDraft, saveDraft, clearDraft, setBaseline, setupWatch }
}
