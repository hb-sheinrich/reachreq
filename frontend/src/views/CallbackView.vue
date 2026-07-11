<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTitle } from '@/composables/useTitle'

useTitle()

const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const token = searchParams.get('token') || hashParams.get('token')

  if (token) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  await auth.handleCallback(token ?? undefined)
  router.replace({ name: 'Home' })
})
</script>

<template>
  <div class="flex h-full items-center justify-center">
    <p class="text-text-muted">Anmeldung läuft...</p>
  </div>
</template>
