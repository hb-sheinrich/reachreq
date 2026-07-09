<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import Button from 'primevue/button'
import Card from 'primevue/card'

const auth = useAuthStore()
</script>

<template>
  <div class="flex h-full items-center justify-center mt-20">
    <Card class="w-full max-w-md">
      <template #title>ReachReq</template>
      <template #subtitle>Anforderungs- und Glossar-Tool</template>
      <template #content>
        <p class="mb-4">Bitte melde dich mit deinem Microsoft 365 Konto an.</p>
        <Button label="Mit Microsoft anmelden" icon="pi pi-microsoft" class="w-full" @click="auth.login" />
      </template>
    </Card>
  </div>
</template>
