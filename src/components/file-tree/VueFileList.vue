<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { FileWarning, X } from 'lucide-vue-next'
import { useEditorStore } from '@/stores/editorStore'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { useVueFileRename } from '@/composables/useVueFileRename'
import { isSameFilePath } from '@/services/pathIdentity'
import { isMarkdownPath } from '@/services/rag/indexer'
import { addKnowledgeDocument, isKnowledgeDocumentIndexed } from '@/services/rag/knowledgeBase'
import { addFileContextTag, summarizeFileWithAi } from '@/services/aiContext'
import { saveExistingFileAs } from '@/services/fileEntryActions'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { readRememberedFile } from '@/services/persistedFileAccess'
import { toast } from '@/services/toast'

type ListedFile = { name: string; path: string }
const { t } = useI18n()
const props = withDefaults(defineProps<{
  files: ListedFile[]
  kind: 'recent' | 'favorite'
  onOpen?: (file: ListedFile) => Promise<void> | void
  onRefreshWorkspace?: () => void
}>(), { onOpen: undefined, onRefreshWorkspace: undefined })

const tabs = useZustandSelector(useEditorStore, (state) => state.tabs)
const activeTabId = useZustandSelector(useEditorStore, (state) => state.activeTabId)
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)
const selected = ref<ListedFile | null>(null)
const kbStatus = ref<'idle' | 'checking' | 'not-indexed' | 'indexed' | 'adding'>('idle')
const missingPaths = ref(new Set<string>())
const showAll = ref(false)
const rename = useVueFileRename()
const renameState = computed(() => rename.state.value)
const visibleFiles = computed(() => props.kind === 'favorite' && !showAll.value ? props.files.slice(0, 20) : props.files)
const activeFilePath = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value)?.filePath ?? null)

async function openFile(file: ListedFile): Promise<void> {
  try {
    if (props.onOpen) { await props.onOpen(file); clearMissing(file.path); return }
    const store = useEditorStore.getState()
    const existing = store.tabs.find((tab) => isSameFilePath(tab.filePath, file.path))
    if (existing) store.setActiveTab(existing.id)
    else store.addTab(file.path, file.name, await readRememberedFile(file.path))
    clearMissing(file.path)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const lower = message.toLowerCase()
    const missing = lower.includes('not found') || lower.includes('os error 2') || message.includes('找不到') || message.includes('不存在')
    if (props.kind === 'favorite' && missing) {
      missingPaths.value = new Set(missingPaths.value).add(file.path)
      toast.error(t('fileList.favoriteFileLost', { name: file.name }))
      props.onRefreshWorkspace?.()
      return
    }
    toast.error(describeFileOperationError(error, props.kind === 'recent' ? t('fileList.openRecentFailed') : t('fileList.openFavoriteFailed')))
  }
}

function clearMissing(path: string): void {
  if (!missingPaths.value.has(path)) return
  const next = new Set(missingPaths.value); next.delete(path); missingPaths.value = next
}

function showMenu(event: MouseEvent, file: ListedFile): void {
  event.preventDefault(); selected.value = file
  if (!isMarkdownPath(file.path)) { kbStatus.value = 'idle'; menu.value?.show(event); return }
  kbStatus.value = 'checking'
  void isKnowledgeDocumentIndexed(file.path).then((indexed) => { kbStatus.value = indexed ? 'indexed' : 'not-indexed' }).catch(() => { kbStatus.value = 'not-indexed' })
  menu.value?.show(event)
}

async function addOrUpdateKnowledge(file: ListedFile): Promise<void> {
  kbStatus.value = 'adding'
  try {
    const result = await addKnowledgeDocument({ filePath: file.path, title: file.name, content: await readRememberedFile(file.path) })
    kbStatus.value = result.success ? 'indexed' : 'not-indexed'
    result.success ? toast.success(kbStatus.value === 'indexed' ? t('tabbar.addToKnowledgeBase') : t('tabbar.updateKnowledgeBase')) : toast.error(result.error || t('fileList.addToKnowledgeBaseFailed'))
  } catch (error) { kbStatus.value = 'not-indexed'; toast.error(error instanceof Error ? error.message : t('fileList.addToKnowledgeBaseFailed')) }
}

const items = computed<MenuItem[]>(() => {
  const file = selected.value
  if (!file) return []
  const list: MenuItem[] = [
    { label: t('tabbar.rename'), command: () => rename.startRename(file.path, file.name) },
    { label: t('tabbar.saveAs'), command: () => void saveExistingFileAs(file.path).then(() => toast.success(t('tabbar.saveAs'))).catch((error) => toast.error(describeFileOperationError(error, t('fileList.saveAsFailed')))) },
    { separator: true },
    { label: t('tabbar.addToContext'), command: () => addFileContextTag({ title: file.name, filePath: file.path }) },
  ]
  if (props.kind === 'favorite') list.push({ label: t('tabbar.summarize'), command: () => summarizeFileWithAi({ title: file.name, filePath: file.path }) })
  if (isMarkdownPath(file.path)) {
    list.push({ separator: true })
    if (kbStatus.value === 'checking') list.push({ label: t('tabbar.readingKnowledgeBase'), disabled: true })
    else if (kbStatus.value === 'adding') list.push({ label: t('tabbar.addingKnowledgeBase'), disabled: true })
    else list.push({ label: kbStatus.value === 'indexed' ? t('tabbar.updateKnowledgeBase') : t('tabbar.addToKnowledgeBase'), command: () => void addOrUpdateKnowledge(file) })
  }
  list.push({ separator: true }, { label: t('tabbar.copyPath'), command: () => void navigator.clipboard.writeText(file.path) })
  if (props.kind === 'recent') list.push({ label: t('fileList.removeRecent'), command: () => useEditorStore.getState().removeRecentFile(file.path) })
  else list.push({ label: t('fileList.removeFavorite'), command: () => useEditorStore.getState().toggleFavorite(file.path) })
  return list
})
</script>

<template>
  <div v-if="files.length" class="gm-vue-file-list">
    <div v-for="file in visibleFiles" :key="file.path" class="gm-vue-file-list__row" :class="{ 'gm-vue-file-list__row--active': isSameFilePath(activeFilePath, file.path), 'gm-vue-file-list__row--missing': missingPaths.has(file.path) }" @click="openFile(file)" @contextmenu="showMenu($event, file)">
      <FileWarning v-if="missingPaths.has(file.path)" :size="13" aria-hidden="true" />
      <span v-if="renameState.targetId === file.path" class="gm-vue-file-list__rename" @click.stop><input autofocus :value="renameState.value" :disabled="rename.isSubmitting.value" @focus="($event.target as HTMLInputElement).select()" @input="rename.setRenameValue(($event.target as HTMLInputElement).value)" @blur="rename.submitRename(file.path, file.path, onRefreshWorkspace)" @keydown.enter.prevent="rename.submitRename(file.path, file.path, onRefreshWorkspace)" @keydown.esc="rename.cancelRename(file.path)" /></span>
      <span v-else class="gm-vue-file-list__name" :title="missingPaths.has(file.path) ? t('fileList.fileLost', { path: file.path }) : file.name">{{ missingPaths.has(file.path) ? t('fileList.fileLost', { path: file.path }) : file.name }}</span>
      <span v-if="missingPaths.has(file.path)" class="gm-vue-file-list__missing">{{ t('fileList.lost') }}</span>
      <button v-if="kind === 'recent'" type="button" :title="t('fileList.removeRecentRecord')" :aria-label="t('fileList.removeRecentRecord')" @click.stop="useEditorStore.getState().removeRecentFile(file.path)"><X :size="12" aria-hidden="true" /></button>
    </div>
    <button v-if="kind === 'favorite' && files.length > 20" type="button" class="gm-vue-file-list__more" @click="showAll = !showAll">{{ showAll ? t('fileList.collapse') : t('fileList.expandMore', { count: files.length - 20 }) }}</button>
    <ContextMenu ref="menu" :model="items" />
  </div>
  <div v-else class="gm-vue-file-list__empty">{{ kind === 'recent' ? t('fileList.noRecentFiles') : t('fileList.noFavorites') }}</div>
</template>

<style scoped>
.gm-vue-file-list { display: grid; gap: 2px; padding: 4px 0; }.gm-vue-file-list__row { display: flex; min-width: 0; align-items: center; gap: 6px; min-height: 27px; padding: 0 8px; color: var(--gm-text-secondary); border-radius: var(--gm-radius-sm); cursor: pointer; font-size: 12px; }.gm-vue-file-list__row:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-file-list__row--active { color: var(--gm-text); background: var(--gm-primary-subtle); font-weight: 700; }.gm-vue-file-list__row--missing { color: var(--gm-text-disabled); background: var(--gm-surface-elevated); }.gm-vue-file-list__name,.gm-vue-file-list__rename { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.gm-vue-file-list input { width: 100%; color: var(--gm-text); background: var(--gm-canvas); border: 1px solid var(--gm-primary); border-radius: var(--gm-radius-sm); outline: 0; }.gm-vue-file-list__row button { display: grid; padding: 2px; place-items: center; color: inherit; background: transparent; border: 0; border-radius: var(--gm-radius-sm); cursor: pointer; opacity: 0; }.gm-vue-file-list__row:hover button { opacity: 1; }.gm-vue-file-list__missing { flex: 0 0 auto; font-size: 10px; }.gm-vue-file-list__more { padding: 5px 8px; color: var(--gm-text-tertiary); background: transparent; border: 0; border-radius: var(--gm-radius-sm); cursor: pointer; font-size: 11px; }.gm-vue-file-list__more:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-file-list__empty { padding: 16px 8px; color: var(--gm-text-tertiary); font-size: 12px; text-align: center; }
</style>
