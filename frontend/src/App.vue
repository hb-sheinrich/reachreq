<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Button from 'primevue/button'
import Menubar from 'primevue/menubar'

const auth = useAuthStore()
const router = useRouter()

onMounted(() => {
  auth.fetchUser()
})

function logout() {
  auth.logout()
  router.push({ name: 'Login' })
}

const menuItems = [
  { label: 'Dashboard', command: () => router.push({ name: 'Home' }) },
  { label: 'Anforderungen', command: () => router.push({ name: 'Requirements' }) },
  { label: 'Glossar', command: () => router.push({ name: 'Glossary' }) },
  { label: 'Module', command: () => router.push({ name: 'Modules' }) },
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <Menubar :model="menuItems" class="rounded-none border-b">
      <template #start>
        <div class="font-bold text-xl px-2">ReachReq</div>
      </template>
      <template #end>
        <div class="flex items-center gap-2">
          <span v-if="auth.user" class="text-sm text-gray-600">{{ auth.user.name }}</span>
          <Button v-if="auth.isAuthenticated" icon="pi pi-sign-out" text size="small" @click="logout" />
        </div>
      </template>
    </Menubar>
    <main class="flex-1 p-4">
      <router-view />
    </main>
  </div>
</template>
