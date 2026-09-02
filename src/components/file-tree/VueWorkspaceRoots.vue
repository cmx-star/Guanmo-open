<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, FolderPlus, RefreshCw, SearchCheck, Trash2 } from 'lucide-vue-next'
import VueFileTree from './VueFileTree.vue'
import { isTauri } from '@/hooks/useTauri'
import { useVueWorkspaceFileTree } from '@/composables/useVueWorkspaceFileTree'
import { pickDirectory } from '@/services/fileSystem'
import { indexWorkspaceMarkdown } from '@/services/rag/indexer'
import { toast } from '@/services/toast'

const { t } = useI18n()
const props = defineProps<{ onOpenFile: (path: string) => void }>()
const { workspaceRoots, workspaceTrees, addWorkspaceRoot, removeWorkspace, refreshWorkspaceRoot } = useVueWorkspaceFileTree()
const collapsedRootIds = ref(new Set<string>())
const workingRootId = ref<string | null>(null)
const rootSummaries = ref<Record<string, string>>({})

function isExpanded(id: string): boolean { return !collapsedRootIds.value.has(id) }
function toggleRoot(id: string): void {
  const next = new Set(collapsedRootIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  collapsedRootIds.value = next
}

async function addWorkspace(): Promise<void> {
  if (!isTauri()) { toast.error(t('workspaceRoots.browserUnavailable')); return }
  try {
    const path = await pickDirectory()
    if (!path) return
    if (!addWorkspaceRoot(path)) toast.error(t('workspaceRoots.alreadyOpen'))
    else toast.success(t('workspaceRoots.added'))
  } catch (error) { console.error('Add workspace failed:', error); toast.error(t('workspaceRoots.addFailed')) }
}

function setSummary(id: string, summary: string | null): void {
  const next = { ...rootSummaries.value }
  if (summary === null) delete next[id]
  else next[id] = summary
  rootSummaries.value = next
}

async function indexRoot(id: string, path: string): Promise<void> {
  if (workingRootId.value) return
  workingRootId.value = id; setSummary(id, null)
  try {
    const result = await indexWorkspaceMarkdown(path)
    let summary = t('workspaceRoots.indexed', { count: result.indexed })
    if (result.failed > 0) summary += t('workspaceRoots.failed', { count: result.failed })
    if (result.errors.length) summary += `\n${result.errors.join('\n')}`
    setSummary(id, summary)
  } catch (error) { setSummary(id, error instanceof Error ? error.message : t('workspaceRoots.indexFailed')) }
  finally { workingRootId.value = null }
}

function removeRoot(id: string): void {
  removeWorkspace(id); setSummary(id, null); toast.success(t('workspaceRoots.removed'))
}
</script>

<template>
  <div class="gm-vue-workspaces">
    <div class="gm-vue-workspaces__toolbar"><span>{{ t('workspaceRoots.openFolders', { count: workspaceRoots.length }) }}</span><button type="button" :title="t('workspaceRoots.addFolder')" :aria-label="t('workspaceRoots.addFolder')" @click="addWorkspace"><FolderPlus :size="15" aria-hidden="true" /></button></div>
    <div v-if="!workspaceRoots.length" class="gm-vue-workspaces__empty"><p>{{ t('workspaceRoots.emptyTitle') }}</p><p>{{ t('workspaceRoots.emptyHint') }}</p></div>
    <section v-for="(root, index) in workspaceRoots" :key="root.id" class="gm-vue-workspaces__root" :class="{ 'gm-vue-workspaces__root--separated': index > 0 }">
      <div class="gm-vue-workspaces__root-header">
        <button type="button" class="gm-vue-workspaces__root-name" :aria-expanded="isExpanded(root.id)" :title="root.path" @click="toggleRoot(root.id)"><ChevronRight :size="14" :class="{ 'gm-vue-workspaces__chevron--open': isExpanded(root.id) }" aria-hidden="true" /><span>{{ root.name }}</span></button>
        <button type="button" :disabled="Boolean(workingRootId)" :title="t('workspaceRoots.indexWorkspace')" :aria-label="t('workspaceRoots.indexWorkspace')" @click="indexRoot(root.id, root.path)"><SearchCheck :size="14" aria-hidden="true" /></button>
        <button type="button" :title="t('workspaceRoots.refreshWorkspace')" :aria-label="t('workspaceRoots.refreshWorkspace')" @click="refreshWorkspaceRoot(root.id)"><RefreshCw :size="14" aria-hidden="true" /></button>
        <button type="button" :title="t('workspaceRoots.removeWorkspace')" :aria-label="t('workspaceRoots.removeWorkspace')" @click="removeRoot(root.id)"><Trash2 :size="14" aria-hidden="true" /></button>
      </div>
      <div v-if="isExpanded(root.id)" class="gm-vue-workspaces__tree">
        <pre v-if="rootSummaries[root.id]" class="gm-vue-workspaces__summary">{{ rootSummaries[root.id] }}</pre>
        <div v-if="workspaceTrees[root.id]?.error" class="gm-vue-workspaces__error"><p>{{ workspaceTrees[root.id]?.error }}</p><button type="button" @click="refreshWorkspaceRoot(root.id)">{{ t('workspaceRoots.retry') }}</button></div>
        <div v-else-if="workspaceTrees[root.id]?.loading && !workspaceTrees[root.id]?.nodes.length" class="gm-vue-workspaces__loading">{{ t('workspaceRoots.loading') }}</div>
        <VueFileTree v-else :nodes="workspaceTrees[root.id]?.nodes ?? []" :workspace-path="root.path" :on-open-file="props.onOpenFile" :on-refresh-workspace="() => refreshWorkspaceRoot(root.id)" :on-close-workspace="() => removeRoot(root.id)" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.gm-vue-workspaces { display: grid; gap: 8px; }.gm-vue-workspaces__toolbar,.gm-vue-workspaces__root-header { display: flex; align-items: center; gap: 4px; }.gm-vue-workspaces__toolbar { justify-content: space-between; padding: 0 4px; color: var(--gm-text-tertiary); font-size: 11px; }.gm-vue-workspaces button { display: grid; padding: 4px; place-items: center; color: var(--gm-text-tertiary); background: transparent; border: 0; border-radius: var(--gm-radius-sm); cursor: pointer; }.gm-vue-workspaces button:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-workspaces button:disabled { cursor: not-allowed; opacity: .5; }.gm-vue-workspaces__root { padding: 6px; }.gm-vue-workspaces__root--separated { border-top: 1px solid var(--gm-border-subtle); }.gm-vue-workspaces__root-name { min-width: 0; flex: 1; grid-template-columns: auto minmax(0, 1fr); justify-content: start; text-align: left; }.gm-vue-workspaces__root-name span { overflow: hidden; color: var(--gm-text-secondary); font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.gm-vue-workspaces__chevron--open { transform: rotate(90deg); }.gm-vue-workspaces__tree { padding-top: 4px; }.gm-vue-workspaces__empty,.gm-vue-workspaces__loading { padding: 16px 8px; color: var(--gm-text-tertiary); font-size: 12px; text-align: center; }.gm-vue-workspaces__empty p + p { margin-top: 4px; color: var(--gm-text-disabled); }.gm-vue-workspaces__summary,.gm-vue-workspaces__error { margin: 4px 0; padding: 6px 8px; overflow-wrap: anywhere; color: var(--gm-text-tertiary); background: var(--gm-surface-elevated); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-sm); font: inherit; font-size: 11px; white-space: pre-wrap; }.gm-vue-workspaces__error { border-color: color-mix(in srgb, var(--gm-danger) 35%, var(--gm-border)); }.gm-vue-workspaces__error button { padding: 3px 0; color: var(--gm-primary); }
</style>
