<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Eye, FilePenLine, GitCompareArrows, PanelLeftClose, Pin, Star, X } from 'lucide-vue-next'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore, type Tab, type ViewMode } from '@/stores/editorStore'
import { exportMarkdownAsHtml, exportMarkdownAsPdf } from '@/services/markdownExport'
import { isSameFilePath } from '@/services/pathIdentity'
import { addFileContextTag, summarizeFileWithAi } from '@/services/aiContext'
import { addKnowledgeDocument, isKnowledgeDocumentIndexed } from '@/services/rag/knowledgeBase'
import { isMarkdownPath } from '@/services/rag/indexer'
import { saveTabAsFile } from '@/services/fileEntryActions'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { toast } from '@/services/toast'
import { useVueFileRename } from '@/composables/useVueFileRename'
import { useZustandSelector } from '@/composables/useZustandSelector'

const tabs = useZustandSelector(useEditorStore, (state) => state.tabs)
const activeTabId = useZustandSelector(useEditorStore, (state) => state.activeTabId)
const viewMode = useZustandSelector(useEditorStore, (state) => state.viewMode)
const favorites = useZustandSelector(useEditorStore, (state) => state.favorites)
const menu = ref<{ x: number; y: number; tabId: string } | null>(null)
const exportMenu = ref<{ x: number; y: number } | null>(null)
const kbStatus = ref<'idle' | 'checking' | 'not-indexed' | 'indexed' | 'adding'>('idle')
const draggedTabId = ref<string | null>(null)
const dragOverTabId = ref<string | null>(null)
const rename = useVueFileRename()
const { t } = useI18n()

const sortedTabs = computed(() => [...tabs.value].sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned))))
const contextTab = computed(() => menu.value ? tabs.value.find((tab) => tab.id === menu.value?.tabId) ?? null : null)

function setActiveTab(id: string): void { useEditorStore.getState().setActiveTab(id) }
function closeTab(id: string): void { useEditorStore.getState().closeTab(id) }
function toggleFavorite(path: string): void { useEditorStore.getState().toggleFavorite(path) }
function setViewMode(mode: ViewMode): void { useEditorStore.getState().setViewMode(mode) }

function openTabMenu(event: MouseEvent, tabId: string): void {
  event.preventDefault()
  menu.value = { x: event.clientX, y: event.clientY, tabId }
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab?.filePath || !isMarkdownPath(tab.filePath)) { kbStatus.value = 'idle'; return }
  kbStatus.value = 'checking'
  void isKnowledgeDocumentIndexed(tab.filePath).then((indexed) => { kbStatus.value = indexed ? 'indexed' : 'not-indexed' }).catch(() => { kbStatus.value = 'not-indexed' })
}

function dragStart(event: DragEvent, tab: Tab): void {
  event.dataTransfer?.setData('application/x-guanmo-tab', JSON.stringify({ tabId: tab.id, filePath: tab.filePath, title: tab.title }))
  event.dataTransfer?.setData('text/plain', tab.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove'
  draggedTabId.value = tab.id
}
function dropTab(event: DragEvent, targetId: string): void {
  event.preventDefault()
  const sourceId = event.dataTransfer?.getData('text/plain') || draggedTabId.value
  if (sourceId && sourceId !== targetId) useEditorStore.getState().reorderTabs(sourceId, targetId)
  draggedTabId.value = null; dragOverTabId.value = null
}

async function runAction(action: string): Promise<void> {
  const tab = contextTab.value
  if (!tab) return
  menu.value = null
  const store = useEditorStore.getState()
  switch (action) {
    case 'close': closeTab(tab.id); break
    case 'closeOthers': tabs.value.filter((item) => item.id !== tab.id && !item.pinned).forEach((item) => closeTab(item.id)); break
    case 'closeRight': tabs.value.slice(tabs.value.findIndex((item) => item.id === tab.id) + 1).filter((item) => !item.pinned).forEach((item) => closeTab(item.id)); break
    case 'closeAll': tabs.value.filter((item) => !item.pinned).forEach((item) => closeTab(item.id)); break
    case 'copyPath': if (tab.filePath) await navigator.clipboard.writeText(tab.filePath); break
    case 'copyContent': await navigator.clipboard.writeText(tab.content); break
    case 'revealFile': if (tab.filePath) await invoke('reveal_file_in_folder', { path: tab.filePath }).catch((error) => toast.error(error instanceof Error ? error.message : t('tabbar.revealFile'))); break
    case 'addToAi': addFileContextTag({ title: tab.title, filePath: tab.filePath }); break
    case 'aiSummarize': summarizeFileWithAi({ title: tab.title, filePath: tab.filePath }); break
    case 'openInRightPane': store.setRightPaneTabId(tab.id); if (store.viewMode !== 'dual-preview') store.setViewMode('dual-preview'); break
    case 'pinTab': store.togglePinTab(tab.id); break
    case 'rename': if (tab.filePath) rename.startRename(tab.id, tab.title); break
    case 'saveAs': await saveTabAsFile(tab).then(() => toast.success(t('tabbar.saveAs'))).catch((error) => toast.error(describeFileOperationError(error, t('tabbar.saveAs')))); break
    case 'addToKb': case 'updateKb': if (!tab.filePath) return; kbStatus.value = 'adding'; await addKnowledgeDocument({ filePath: tab.filePath, title: tab.title, content: tab.content }).then((result) => { kbStatus.value = result.success ? 'indexed' : 'not-indexed'; result.success ? toast.success(t('tabbar.addToKnowledgeBase')) : toast.error(result.error || t('tabbar.addToKnowledgeBase')) }).catch((error) => { kbStatus.value = 'not-indexed'; toast.error(error instanceof Error ? error.message : t('tabbar.addToKnowledgeBase')) }); break
  }
}

async function exportCurrent(format: 'html' | 'pdf'): Promise<void> {
  exportMenu.value = null
  const tab = tabs.value.find((item) => item.id === activeTabId.value)
  if (!tab) return
  try {
    const title = tab.title.replace(/\.(md|markdown|mdx)$/i, '')
    if (format === 'html') await exportMarkdownAsHtml(tab.content, title, tab.filePath)
    else { await exportMarkdownAsPdf(tab.content, title, tab.filePath); toast.success(t('tabbar.exportPdf')) }
  } catch (error) { toast.error(error instanceof Error ? error.message : t('common.export')) }
}
</script>

<template>
  <div v-if="tabs.length" class="gm-vue-tabbar">
    <div class="gm-vue-tabbar__tabs">
      <div v-for="tab in sortedTabs" :key="tab.id" class="gm-vue-tab" :class="{ 'gm-vue-tab--active': activeTabId === tab.id, 'gm-vue-tab--dragging': draggedTabId === tab.id, 'gm-vue-tab--drop-target': dragOverTabId === tab.id && draggedTabId !== tab.id }" role="button" tabindex="0" :draggable="!rename.isRenaming(tab.id)" @click="setActiveTab(tab.id)" @keydown.enter="setActiveTab(tab.id)" @keydown.space.prevent="setActiveTab(tab.id)" @contextmenu="openTabMenu($event, tab.id)" @dragstart="dragStart($event, tab)" @dragover.prevent="dragOverTabId = tab.id" @dragleave="dragOverTabId = null" @drop="dropTab($event, tab.id)" @dragend="draggedTabId = null; dragOverTabId = null">
        <input v-if="rename.isRenaming(tab.id)" autofocus :value="rename.state.value" :disabled="rename.isSubmitting.value" @click.stop @input="rename.setRenameValue(($event.target as HTMLInputElement).value)" @blur="tab.filePath && rename.submitRename(tab.id, tab.filePath)" @keydown.enter.stop.prevent="tab.filePath && rename.submitRename(tab.id, tab.filePath)" @keydown.esc.stop="rename.cancelRename(tab.id)" />
        <span v-else>{{ tab.title }}</span><Pin v-if="tab.pinned" :size="11" fill="currentColor" aria-hidden="true" /><i v-if="tab.modified" class="gm-vue-tab__modified" aria-hidden="true"></i>
        <button v-if="tab.filePath" type="button" :title="favorites.some((path) => isSameFilePath(path, tab.filePath!)) ? t('tabbar.unfavorite') : t('tabbar.favorite')" @click.stop="toggleFavorite(tab.filePath)"><Star :size="13" :fill="favorites.some((path) => isSameFilePath(path, tab.filePath!)) ? 'currentColor' : 'none'" aria-hidden="true" /></button>
        <button type="button" :title="t('tabbar.close')" :aria-label="t('tabbar.close')" @click.stop="closeTab(tab.id)"><X :size="12" aria-hidden="true" /></button>
      </div>
    </div>
    <div class="gm-vue-tabbar__modes" data-product-tour="mode-switcher"><button type="button" :disabled="!activeTabId" @click="exportMenu = exportMenu ? null : { x: 0, y: 0 }">{{ t('common.export') }}</button><button type="button" :title="t('tabbar.edit')" :aria-label="t('tabbar.edit')" :data-active="viewMode === 'edit'" @click="setViewMode('edit')"><FilePenLine :size="15" aria-hidden="true" /></button><button type="button" :title="t('tabbar.preview')" :aria-label="t('tabbar.preview')" :data-active="viewMode === 'preview'" @click="setViewMode('preview')"><Eye :size="15" aria-hidden="true" /></button><button type="button" :title="t('tabbar.split')" :aria-label="t('tabbar.split')" :data-active="viewMode === 'edit-preview'" @click="setViewMode('edit-preview')"><PanelLeftClose :size="15" aria-hidden="true" /></button><button type="button" :title="t('tabbar.compare')" :aria-label="t('tabbar.compare')" :data-active="viewMode === 'dual-preview'" @click="setViewMode('dual-preview')"><Copy :size="15" aria-hidden="true" /></button><button type="button" :title="t('tabbar.diff')" :aria-label="t('tabbar.diff')" :data-active="viewMode === 'diff-preview'" @click="setViewMode('diff-preview')"><GitCompareArrows :size="15" aria-hidden="true" /></button></div>
    <div v-if="exportMenu" class="gm-vue-tab-menu gm-vue-tab-menu--export"><strong>{{ t('common.export') }}</strong><button type="button" @click="exportCurrent('pdf')">{{ t('tabbar.exportPdf') }}</button><button type="button" @click="exportCurrent('html')">{{ t('tabbar.exportHtml') }}</button></div>
    <div v-if="menu && contextTab" class="gm-vue-tab-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"><strong>{{ t('tabbar.operations') }}</strong><button type="button" @click="runAction('pinTab')">{{ contextTab.pinned ? t('tabbar.unpin') : t('tabbar.pin') }}</button><button type="button" @click="runAction('openInRightPane')">{{ t('tabbar.openInRight') }}</button><button type="button" :disabled="!contextTab.filePath" @click="runAction('rename')">{{ t('tabbar.rename') }}</button><button type="button" @click="runAction('saveAs')">{{ t('tabbar.saveAs') }}</button><strong>{{ t('tabbar.assistant') }}</strong><button type="button" @click="runAction('aiSummarize')">{{ t('tabbar.summarize') }}</button><button type="button" @click="runAction('addToAi')">{{ t('tabbar.addToContext') }}</button><strong>{{ t('tabbar.copyAndIndex') }}</strong><button type="button" @click="runAction('copyContent')">{{ t('tabbar.copyContent') }}</button><button v-if="contextTab.filePath" type="button" @click="runAction('copyPath')">{{ t('tabbar.copyPath') }}</button><button v-if="contextTab.filePath" type="button" @click="runAction('revealFile')">{{ t('tabbar.revealFile') }}</button><template v-if="contextTab.filePath && isMarkdownPath(contextTab.filePath)"><strong>{{ t('tabbar.knowledgeBase') }}</strong><button v-if="kbStatus === 'not-indexed'" type="button" @click="runAction('addToKb')">{{ t('tabbar.addToKnowledgeBase') }}</button><button v-else-if="kbStatus === 'indexed'" type="button" @click="runAction('updateKb')">{{ t('tabbar.updateKnowledgeBase') }}</button><button v-else type="button" disabled>{{ kbStatus === 'adding' ? t('tabbar.addingKnowledgeBase') : t('tabbar.readingKnowledgeBase') }}</button></template><strong>{{ t('tabbar.closeTabs') }}</strong><button type="button" @click="runAction('close')">{{ t('tabbar.close') }}</button><button type="button" @click="runAction('closeOthers')">{{ t('tabbar.closeOthers') }}</button><button type="button" @click="runAction('closeRight')">{{ t('tabbar.closeRight') }}</button><button type="button" @click="runAction('closeAll')">{{ t('tabbar.closeAll') }}</button></div>
  </div>
</template>

<style scoped>
.gm-vue-tabbar { position: relative; display: flex; height: 40px; min-width: 0; background: var(--gm-surface); border-bottom: 1px solid var(--gm-border); }.gm-vue-tabbar__tabs { display: flex; min-width: 0; flex: 1; overflow-x: auto; }.gm-vue-tab { display: flex; height: 100%; min-width: 0; max-width: 260px; padding: 0 10px; align-items: center; gap: 6px; color: var(--gm-text-secondary); border-right: 1px solid var(--gm-border-subtle); cursor: pointer; font-size: 12px; }.gm-vue-tab > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.gm-vue-tab--active { color: var(--gm-text); background: var(--gm-canvas); border-bottom: 2px solid var(--gm-active-indicator); font-weight: 700; }.gm-vue-tab--dragging { opacity: .5; }.gm-vue-tab--drop-target { border-left: 2px solid var(--gm-primary); }.gm-vue-tab input { width: 128px; color: var(--gm-text); background: var(--gm-canvas); border: 1px solid var(--gm-primary); border-radius: var(--gm-radius-sm); outline: none; }.gm-vue-tab button,.gm-vue-tabbar__modes button { display: grid; padding: 3px; place-items: center; color: inherit; background: transparent; border: 0; border-radius: var(--gm-radius-sm); cursor: pointer; }.gm-vue-tab button:hover,.gm-vue-tabbar__modes button:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-tab__modified { width: 7px; height: 7px; flex: 0 0 auto; background: var(--gm-primary); border-radius: 50%; }.gm-vue-tabbar__modes { display: flex; padding: 4px 8px; align-items: center; gap: 2px; border-left: 1px solid var(--gm-border-subtle); }.gm-vue-tabbar__modes > button:first-child { margin-right: 6px; padding: 3px 8px; border: 1px solid var(--gm-border); font-weight: 700; }.gm-vue-tabbar__modes [data-active='true'] { color: var(--gm-primary); }.gm-vue-tab-menu { position: fixed; z-index: 100; display: grid; min-width: 176px; max-height: 70vh; padding: 6px 0; overflow-y: auto; color: var(--gm-text); background: var(--gm-surface); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-md); box-shadow: var(--gm-shadow-md); }.gm-vue-tab-menu--export { top: 44px; right: 8px; left: auto; }.gm-vue-tab-menu strong { margin: 4px 6px; padding: 3px 8px; color: var(--gm-text-tertiary); border-left: 2px solid var(--gm-primary); font-size: 10px; }.gm-vue-tab-menu button { padding: 6px 14px; color: var(--gm-text); text-align: left; background: transparent; border: 0; cursor: pointer; font-size: 12px; }.gm-vue-tab-menu button:hover { background: var(--gm-surface-hover); }.gm-vue-tab-menu button:disabled { opacity: .5; cursor: not-allowed; }
</style>
