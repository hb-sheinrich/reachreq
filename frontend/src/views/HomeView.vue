<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRequirementsStore } from '@/stores/requirements'
import { useGlossaryStore } from '@/stores/glossary'
import Card from 'primevue/card'

const reqStore = useRequirementsStore()
const glosStore = useGlossaryStore()
const counts = ref({ draft: 0, inReview: 0, submitted: 0, approved: 0, glossary: 0 })

onMounted(async () => {
  await reqStore.fetchRequirements({ take: 1000 })
  await glosStore.fetchEntries({ take: 1000 })
  counts.value = {
    draft: reqStore.requirements.filter((r) => r.status === 'DRAFT').length,
    inReview: reqStore.requirements.filter((r) => r.status === 'IN_REVIEW').length,
    submitted: reqStore.requirements.filter((r) => r.status === 'SUBMITTED_FOR_RELEASE').length,
    approved: reqStore.requirements.filter((r) => r.status === 'APPROVED').length,
    glossary: glosStore.total,
  }
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <Card>
      <template #title>Entwürfe</template>
      <template #content>{{ counts.draft }}</template>
    </Card>
    <Card>
      <template #title>In Prüfung</template>
      <template #content>{{ counts.inReview }}</template>
    </Card>
    <Card>
      <template #title>Zur Freigabe</template>
      <template #content>{{ counts.submitted }}</template>
    </Card>
    <Card>
      <template #title>Freigegeben</template>
      <template #content>{{ counts.approved }}</template>
    </Card>
  </div>
</template>
