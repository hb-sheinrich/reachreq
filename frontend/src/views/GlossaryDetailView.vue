<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useGlossaryStore } from '@/stores/glossary'
import { useAuthStore } from '@/stores/auth'
import { useAutosave } from '@/services/autosave'
import { useTitle } from '@/composables/useTitle'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import TabPanel from 'primevue/tabpanel'
import TabView from 'primevue/tabview'
import Dialog from 'primevue/dialog'
import AutosaveIndicator from '@/components/AutosaveIndicator.vue'
import AIReviewPanel from '@/components/AIReviewPanel.vue'
import CommentList from '@/components/CommentList.vue'

const route = useRoute()
const store = useGlossaryStore()
const auth = useAuthStore()

const id = computed(() => route.params.id as string)
const draft = ref<any>({})
const activeTab = ref(0)
const showReject = ref(false)
const rejectReason = ref('')
const reviewTrigger = ref(0)

useTitle(computed(() => store.current?.term || ''))

onMounted(async () => {
  await store.fetchEntry(id.value)
  await store.fetchVersions(id.value)
})

watch(id, (newId) => store.fetchEntry(newId))

watch(() => store.current, (entry) => {
  if (entry) draft.value = { ...entry, tags: (entry.tags || []).join(', ') }
})

function payload() {
  return {
    ...draft.value,
    tags: draft.value.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
  }
}

const { status, statusMessage, forceSave, setupWatch } = useAutosave(
  id.value,
  payload,
  (data) => store.updateEntry(id.value, data)
)

setupWatch(draft)

async function submit() {
  await forceSave()
  await store.submitEntry(id.value)
  reviewTrigger.value++
}

async function approve() {
  await store.approveEntry(id.value)
}

async function reject() {
  await store.rejectEntry(id.value, rejectReason.value)
  showReject.value = false
}

async function reopen() {
  await store.reopenEntry(id.value)
}

async function runReview() {
  return await store.review(id.value)
}
</script>

<template>
  <div v-if="store.current" class="space-y-4">
    <div class="flex justify-between items-center">
      <h1 class="text-h1 font-display font-semibold text-text">{{ store.current.term }}</h1>
      <div class="flex items-center gap-2">
        <AutosaveIndicator :status="status" :message="statusMessage" />
        <Button v-if="store.current.status === 'DRAFT'" label="Zur Freigabe" @click="submit" />
        <Button v-if="auth.isAdmin && store.current.status === 'SUBMITTED_FOR_RELEASE'" label="Freigeben" severity="success" @click="approve" />
        <Button v-if="auth.isAdmin && store.current.status === 'SUBMITTED_FOR_RELEASE'" label="Ablehnen" severity="danger" @click="showReject = true" />
        <Button v-if="auth.isAdmin && (store.current.status === 'APPROVED' || store.current.status === 'REJECTED')" label="Wieder öffnen" @click="reopen" />
      </div>
    </div>

    <TabView v-model:activeIndex="activeTab">
      <TabPanel value="0" header="Editor">
        <div class="space-y-3">
          <InputText v-model="draft.term" placeholder="Begriff" class="w-full" />
          <Textarea v-model="draft.definition" placeholder="Definition" rows="4" class="w-full" />
          <Textarea v-model="draft.example" placeholder="Beispiel" rows="3" class="w-full" />
          <InputText v-model="draft.tags" placeholder="Tags (kommasepariert)" class="w-full" />
        </div>
      </TabPanel>
      <TabPanel value="1" header="KI-Prüfung">
        <AIReviewPanel :key="reviewTrigger" :review-fn="runReview" />
      </TabPanel>
      <TabPanel value="2" header="Versionen">
        <ul class="space-y-2">
          <li v-for="v in store.versions" :key="v.id" class="border p-2 rounded">
            <div class="flex justify-between">
              <span class="font-bold">Version {{ v.versionNumber }}</span>
              <span class="text-sm text-gray-600">{{ new Date(v.createdAt).toLocaleString() }}</span>
            </div>
            <div>{{ v.term }}</div>
          </li>
        </ul>
      </TabPanel>
      <TabPanel value="3" header="Kommentare">
        <CommentList :glossary-entry-id="id" />
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
