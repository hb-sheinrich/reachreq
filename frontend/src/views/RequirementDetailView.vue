<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRequirementsStore } from '@/stores/requirements'
import { useModulesStore } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useAutosave } from '@/services/autosave'
import { useTitle } from '@/composables/useTitle'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Dropdown from 'primevue/dropdown'
import TabPanel from 'primevue/tabpanel'
import TabView from 'primevue/tabview'
import Dialog from 'primevue/dialog'
import AutosaveIndicator from '@/components/AutosaveIndicator.vue'
import AIReviewPanel from '@/components/AIReviewPanel.vue'
import CommentList from '@/components/CommentList.vue'

const route = useRoute()
const router = useRouter()
const store = useRequirementsStore()
const modulesStore = useModulesStore()
const auth = useAuthStore()

const id = computed(() => route.params.id as string)
const draft = ref<any>({})
const activeTab = ref(0)
const showReject = ref(false)
const rejectReason = ref('')
const reviewTrigger = ref(0)

useTitle(computed(() => store.current?.humanReadableId || ''))

const statusOptions = [
  { label: 'Entwurf', value: 'DRAFT' },
  { label: 'In Prüfung', value: 'IN_REVIEW' },
]

const classificationOptions = [
  { label: 'Must have', value: 'MUST_HAVE' },
  { label: 'Should have', value: 'SHOULD_HAVE' },
  { label: 'Nice to have', value: 'NICE_TO_HAVE' },
  { label: "Won't have", value: 'WONT_HAVE' },
]

onMounted(async () => {
  await modulesStore.fetchModules()
  await store.fetchRequirement(id.value)
  await store.fetchVersions(id.value)
  initDraft()
})

watch(id, async (newId) => {
  await store.fetchRequirement(newId)
  initDraft()
})

function initDraft() {
  if (store.current) {
    draft.value = { ...store.current, acceptanceCriteria: (store.current.acceptanceCriteria || []).join('\n') }
  }
}

function payload() {
  return {
    ...draft.value,
    acceptanceCriteria: draft.value.acceptanceCriteria.split('\n').filter((x: string) => x.trim()).map((x: string) => x.trim()),
  }
}

const { status, statusMessage, forceSave, setupWatch } = useAutosave(
  id.value,
  payload,
  (data) => store.updateRequirement(id.value, data, store.current?.editVersion || 0)
)

setupWatch(draft)

async function submit() {
  await forceSave()
  await store.submitRequirement(id.value)
  reviewTrigger.value++
}

async function approve() {
  await store.approveRequirement(id.value)
}

async function reject() {
  await store.rejectRequirement(id.value, rejectReason.value)
  showReject.value = false
}

async function reopen() {
  await store.startEdit(id.value)
  initDraft()
}

async function runReview() {
  return await store.review(id.value)
}

function onIgnoreWarnings(reason: string) {
  store.submitRequirement(id.value, { ignoreWarningsReason: reason })
}
</script>

<template>
  <div v-if="store.current" class="space-y-4">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-h1 font-display font-semibold text-text">{{ store.current.humanReadableId }}</h1>
        <p class="text-sm text-text-muted">Status: {{ $t(`status.${store.current.status}`) }}</p>
      </div>
      <div class="flex items-center gap-2">
        <AutosaveIndicator :status="status" :message="statusMessage" />
        <Button v-if="store.current.status === 'DRAFT' || store.current.status === 'IN_REVIEW'" label="Zur Freigabe" @click="submit" />
        <Button v-if="auth.isAdmin && store.current.status === 'SUBMITTED_FOR_RELEASE'" label="Freigeben" severity="success" @click="approve" />
        <Button v-if="auth.isAdmin && store.current.status === 'SUBMITTED_FOR_RELEASE'" label="Ablehnen" severity="danger" @click="showReject = true" />
        <Button v-if="auth.isAdmin && (store.current.status === 'APPROVED' || store.current.status === 'REJECTED')" label="Wieder öffnen" @click="reopen" />
      </div>
    </div>

    <TabView v-model:activeIndex="activeTab">
      <TabPanel value="0" header="Editor">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-3">
            <InputText v-model="draft.title" placeholder="Titel" class="w-full" />
            <Dropdown v-model="draft.moduleId" :options="modulesStore.modules" option-label="name" option-value="id" placeholder="Modul" class="w-full" />
            <Dropdown v-model="draft.classification" :options="classificationOptions" option-label="label" option-value="value" placeholder="Klassifizierung" class="w-full" />
            <Dropdown v-model="draft.status" :options="statusOptions" option-label="label" option-value="value" placeholder="Status" class="w-full" />
            <InputText v-model="draft.source" placeholder="Quelle" class="w-full" />
          </div>
          <div class="space-y-3">
            <Textarea v-model="draft.description" placeholder="Beschreibung" rows="6" class="w-full" />
            <Textarea v-model="draft.context" placeholder="Kontext" rows="3" class="w-full" />
            <Textarea v-model="draft.acceptanceCriteria" placeholder="Akzeptanzkriterien (eine pro Zeile)" rows="4" class="w-full" />
          </div>
        </div>
      </TabPanel>
      <TabPanel value="1" header="KI-Prüfung">
        <AIReviewPanel :key="reviewTrigger" :review-fn="runReview" :on-ignore-warnings="onIgnoreWarnings" />
      </TabPanel>
      <TabPanel value="2" header="Versionen">
        <ul class="space-y-2">
          <li v-for="v in store.versions" :key="v.id" class="border p-2 rounded">
            <div class="flex justify-between">
              <span class="font-bold">Version {{ v.versionNumber }}</span>
              <span class="text-sm text-gray-600">{{ new Date(v.createdAt).toLocaleString() }}</span>
            </div>
            <div>{{ v.title }}</div>
            <div v-if="v.changeComment" class="text-sm text-gray-500">{{ v.changeComment }}</div>
            <Button size="small" label="Wiederherstellen" @click="store.rollbackRequirement(id, v.id)" />
          </li>
        </ul>
      </TabPanel>
      <TabPanel value="3" header="Kommentare">
        <CommentList :requirement-id="id" />
      </TabPanel>
    </TabView>

    <Dialog v-model:visible="showReject" header="Ablehnen" modal>
      <div class="space-y-3 min-w-96">
        <Textarea v-model="rejectReason" placeholder="Begründung" class="w-full" />
        <Button label="Ablehnen" severity="danger" class="w-full" @click="reject" />
      </div>
    </Dialog>
  </div>
</template>
