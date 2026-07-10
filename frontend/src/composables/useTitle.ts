import { useRoute } from 'vue-router'
import { isRef, watch, type Ref } from 'vue'

const BASE = 'ReachReq'

export function useTitle(initial?: string | Ref<string | undefined>) {
  const route = useRoute()

  function setTitle(prefix?: string) {
    document.title = prefix ? `${prefix} · ${BASE}` : BASE
  }

  if (initial) {
    if (isRef(initial)) {
      const initialValue = initial.value
      if (initialValue) setTitle(initialValue)
      watch(initial, (value) => setTitle(value || ''))
    } else {
      setTitle(initial)
    }
  } else {
    const metaTitle = route.meta.title as string | undefined
    if (metaTitle) setTitle(metaTitle)
  }

  return { setTitle }
}
