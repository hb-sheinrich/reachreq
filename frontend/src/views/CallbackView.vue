<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (token) {
    auth.handleCallback(token)
    router.push({ name: 'Home' })
  } else {
    router.push({ name: 'Login' })
  }
})
</script>

<template>
  <div class="flex h-full items-center justify-center">
    <p>Anmeldung läuft...</p>
  </div>
</template>
