<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRequirementsStore } from '@/stores/requirements'
import { useGlossaryStore } from '@/stores/glossary'
import { useTitle } from '@/composables/useTitle'
import DashboardTile from '@/components/DashboardTile.vue'

const { t } = useI18n()
const reqStore = useRequirementsStore()
const glosStore = useGlossaryStore()
const counts = ref({ draft: 0, inReview: 0, submitted: 0, approved: 0, glossary: 0 })

useTitle()

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
    <DashboardTile
      :to="{ name: 'Requirements', query: { status: 'DRAFT' } }"
      :label="t('status.DRAFT')"
      :count="counts.draft"
      status="draft"
    />
    <DashboardTile
      :to="{ name: 'Requirements', query: { status: 'IN_REVIEW' } }"
      :label="t('status.IN_REVIEW')"
      :count="counts.inReview"
      status="in-review"
    />
    <DashboardTile
      :to="{ name: 'Requirements', query: { status: 'SUBMITTED_FOR_RELEASE' } }"
      :label="t('status.SUBMITTED_FOR_RELEASE')"
      :count="counts.submitted"
      status="submitted"
    />
    <DashboardTile
      :to="{ name: 'Requirements', query: { status: 'APPROVED' } }"
      :label="t('status.APPROVED')"
      :count="counts.approved"
      status="approved"
    />
  </div>
</template>
