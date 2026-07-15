<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '@/services/api'
import { useGlossaryStore } from '@/stores/glossary'
import { useTitle } from '@/composables/useTitle'
import DashboardTile from '@/components/DashboardTile.vue'

const { t } = useI18n()
const glosStore = useGlossaryStore()

useTitle()

const statusOrder = [
  'DRAFT',
  'IN_REVIEW',
  'SUBMITTED_FOR_RELEASE',
  'APPROVED',
  'REJECTED',
  'POSTPONED',
  'IMPORTED',
  'ARCHIVED',
]

const counts = ref<Record<string, number>>({})

onMounted(async () => {
  const [reqData] = await Promise.all([
    api.get('/requirements/counts'),
    glosStore.fetchEntries({ take: 1000 }),
  ])
  counts.value = reqData.counts || {}
})

const visibleStatuses = computed(() =>
  statusOrder.filter((status) => counts.value[status] !== undefined)
)
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <DashboardTile
      v-for="status in visibleStatuses"
      :key="status"
      :to="{ name: 'Requirements', query: { status } }"
      :label="t(`status.${status}`)"
      :count="counts[status] || 0"
      :status="status"
    />
  </div>
</template>
