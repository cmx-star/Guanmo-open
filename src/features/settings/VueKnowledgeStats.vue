<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { isTauri } from '@/hooks/useTauri'
import { initEmbeddingClient, isLocalApi } from '@/services/ai/aiClient'
import { toast } from '@/services/toast'
import { cleanupMissingWorkspaceDocuments, rebuildWorkspaceDocuments } from '@/services/workspaceIndex'
import { embedPendingChunks, getEmbeddingJobStats, getKnowledgeIndexStateSummary, getRagStatsAsync, processEmbeddingQueue, retryFailedEmbeddingJobs } from '@/services/rag/pipeline'
import { useAppStore } from '@/stores/appStore'
import { useSettingsStore } from '@/stores/settingsStore'

const { t } = useI18n()
const props = defineProps<{ onOpenManager: () => void }>()
const ai = useZustandSelector(useSettingsStore, (state) => state.ai)
const roots = useZustandSelector(useAppStore, (state) => state.workspaceRoots)
const workspacePaths = computed(() => roots.value.map((root) => root.path))
const stats = ref({ documents: 0, totalChunks: 0, embeddedChunks: 0, pendingEmbeddings: 0 })
const jobs = ref({ pending: 0, running: 0, done: 0, failed: 0 })
const states = ref({ PENDING: 0, CHUNKED: 0, EMBEDDING: 0, INDEXED: 0, FAILED: 0 })
const busy = ref(false), message = ref<string | null>(null), status = ref<'loading' | 'ready' | 'error'>('loading'), indexedAt = ref<number | null>(null)

async function refresh(): Promise<void> {
  status.value = 'loading'
  try { [stats.value, jobs.value, states.value] = await Promise.all([getRagStatsAsync(), getEmbeddingJobStats(), getKnowledgeIndexStateSummary()]); status.value = 'ready' } catch { status.value = 'error' }
}
async function processQueue(retry = false): Promise<void> {
  message.value = null
  if (!ai.value.embedding.apiKey && !isLocalApi(ai.value.embedding.baseUrl)) { message.value = t('knowledgeStats.needEmbeddingKey'); return }
  busy.value = true
  try { initEmbeddingClient(ai.value.embedding); if (retry) await retryFailedEmbeddingJobs(); const [queued, pending] = await Promise.all([processEmbeddingQueue(), embedPendingChunks()]); await refresh(); message.value = t('knowledgeStats.queueDone', { embedded: queued.embedded, pending: pending.embedded, failed: queued.failed + pending.failed }) } catch (error) { message.value = error instanceof Error ? error.message : String(error) } finally { busy.value = false }
}
async function cleanup(): Promise<void> {
  if (!workspacePaths.value.length) { message.value = t('knowledgeStats.needWorkspaceForCleanup'); return }
  busy.value = true
  try { const result = await cleanupMissingWorkspaceDocuments(workspacePaths.value); await refresh(); message.value = result.errors.length ? t('knowledgeStats.cleaned', { removed: result.removed, errors: result.errors.length }) : result.removed ? t('knowledgeStats.cleanedSome', { removed: result.removed }) : t('knowledgeStats.noStaleIndexes') } catch (error) { message.value = error instanceof Error ? error.message : String(error) } finally { busy.value = false }
}
async function rebuild(): Promise<void> {
  if (!workspacePaths.value.length) { message.value = t('knowledgeStats.needWorkspaceForRebuild'); return }
  busy.value = true
  try { const result = await rebuildWorkspaceDocuments(workspacePaths.value); await refresh(); indexedAt.value = Date.now(); message.value = t('knowledgeStats.rebuilt', { removed: result.removed, indexed: result.indexed, failed: result.failed }) } catch (error) { message.value = error instanceof Error ? error.message : String(error) } finally { busy.value = false }
}
onMounted(() => { void refresh() })
</script>

<template>
  <section class="gm-vue-kb-stats"><div class="gm-vue-kb-stats__numbers"><div><b>{{ stats.documents }}</b><small>{{ t('knowledgeStats.docs') }}</small></div><div><b>{{ stats.totalChunks }}</b><small>{{ t('knowledgeStats.chunks') }}</small></div><div><b>{{ stats.embeddedChunks }}</b><small>{{ t('knowledgeStats.embedded') }}</small></div><div><b>{{ stats.pendingEmbeddings }}</b><small>{{ t('knowledgeStats.pendingEmbeddings') }}</small></div></div><p class="gm-vue-settings-notice">{{ t('knowledgeStats.queueStatus', { pending: jobs.pending, running: jobs.running, done: jobs.done, failed: jobs.failed }) }}</p><p class="gm-vue-settings-notice">{{ t('knowledgeStats.stateMachine', { PENDING: states.PENDING, CHUNKED: states.CHUNKED, EMBEDDING: states.EMBEDDING, INDEXED: states.INDEXED, FAILED: states.FAILED }) }}<br />Embedding 提供方：{{ ai.embedding.baseUrl || t('knowledgeStats.notConfigured') }}<template v-if="indexedAt"> · {{ t('knowledgeStats.lastRebuild', { date: new Date(indexedAt).toLocaleString() }) }}</template></p><div class="gm-vue-settings-actions"><button type="button" :disabled="busy || (stats.pendingEmbeddings === 0 && jobs.pending === 0)" @click="processQueue()">{{ t('knowledgeStats.processQueue') }}</button><button type="button" :disabled="!isTauri()" @click="props.onOpenManager">{{ t('knowledgeStats.manageDocuments') }}</button><button type="button" :disabled="busy || jobs.failed === 0" @click="processQueue(true)">{{ t('knowledgeStats.retryFailed') }}</button><button type="button" :disabled="busy" @click="refresh">{{ t('knowledgeStats.refreshStats') }}</button><button type="button" :disabled="busy" @click="cleanup">{{ t('knowledgeStats.cleanup') }}</button><button type="button" :disabled="busy" @click="rebuild">{{ t('knowledgeStats.rebuild') }}</button></div><p v-if="message" class="gm-vue-settings-notice">{{ message }}</p><p v-if="status === 'loading'" class="gm-vue-settings-notice">{{ t('knowledgeStats.loading') }}</p><p v-else-if="status === 'error'" class="gm-vue-settings-error">{{ t('knowledgeStats.loadFailed') }}</p></section>
</template>

<style scoped>
.gm-vue-kb-stats { display: grid; gap: 8px; padding: 6px 0; }.gm-vue-kb-stats__numbers { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }.gm-vue-kb-stats__numbers > div { display: grid; padding: 8px 4px; gap: 3px; text-align: center; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-sm); background: var(--gm-surface-elevated); }.gm-vue-kb-stats__numbers b { color: var(--gm-text); font-size: var(--gm-text-lg); }.gm-vue-kb-stats__numbers small { color: var(--gm-text-tertiary); font-size: var(--gm-text-xs); }
</style>
