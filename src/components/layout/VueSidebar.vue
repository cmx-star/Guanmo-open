<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Panel from 'primevue/panel'
import { FolderOpen, FolderUp, Menu, PanelLeftClose, Search, Settings2 } from 'lucide-vue-next'
import VueFileList from '@/components/file-tree/VueFileList.vue'
import VueWorkspaceRoots from '@/components/file-tree/VueWorkspaceRoots.vue'
import { useAppStore } from '@/stores/appStore'
import { useEditorStore } from '@/stores/editorStore'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { getTextFileSize, isTauri, readFile } from '@/hooks/useTauri'
import { openFile, pickDirectory } from '@/services/fileSystem'
import { isWorkspaceDisplayFile } from '@/services/fileTree'
import { scheduleMarkdownDocumentIndex } from '@/services/rag/indexer'
import { isSameFilePath } from '@/services/pathIdentity'
import { toast } from '@/services/toast'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { getRememberedTextFileSize, readRememberedFile } from '@/services/persistedFileAccess'
import { assertSupportedMarkdownFileSize } from '@/services/fileSizeLimit'

const props = defineProps<{
  collapsed: boolean
  width: number
  onResizeStart: (event: MouseEvent) => void
  onOpenSettings: () => void
  onOpenSearch: () => void
}>()
const { t } = useI18n()
const recentFiles = useZustandSelector(useEditorStore, (state) => state.recentFiles.filter((file) => isWorkspaceDisplayFile(file.path)))
const favorites = useZustandSelector(useEditorStore, (state) => state.favorites.filter(isWorkspaceDisplayFile))
const tabs = useZustandSelector(useEditorStore, (state) => state.tabs)
const favoriteFiles = computed(() => favorites.value.map((path) => {
  const tab = tabs.value.find((item) => item.filePath === path)
  return { path, name: tab?.title || path.split(/[/\\]/).pop() || path }
}))

function toggleSidebar(): void { useAppStore.getState().toggleSidebar() }
function refreshWorkspaces(): void { window.dispatchEvent(new Event('guanmo:workspace-refresh')) }

async function openStandaloneFile(): Promise<void> {
  try {
    const file = await openFile()
    if (!file) return
    const store = useEditorStore.getState()
    const existing = store.tabs.find((tab) => isSameFilePath(tab.filePath, file.path))
    if (existing) store.setActiveTab(existing.id)
    else store.addTab(file.path, file.name, file.content)
    scheduleMarkdownDocumentIndex(file.path, file.name, file.content)
  } catch (error) { console.error('Open file failed:', error); toast.error(describeFileOperationError(error, t('sidebar.openFile'))) }
}

async function openFolder(): Promise<void> {
  if (!isTauri()) { toast.error(t('common.unavailableInBrowser')); return }
  try {
    const path = await pickDirectory()
    if (!path) return
    if (!useAppStore.getState().addWorkspaceRoot(path)) toast.error(t('sidebar.workspaceAlreadyOpen'))
  } catch (error) { console.error('Open folder failed:', error); toast.error(describeFileOperationError(error, t('sidebar.openFolder'))) }
}

async function openWorkspaceFile(path: string): Promise<void> {
  try {
    if (!isWorkspaceDisplayFile(path)) return
    assertSupportedMarkdownFileSize(await getTextFileSize(path))
    const content = await readFile(path)
    const name = path.split(/[/\\]/).pop() || 'untitled.md'
    const store = useEditorStore.getState()
    const existing = store.tabs.find((tab) => isSameFilePath(tab.filePath, path))
    if (existing) store.setActiveTab(existing.id)
    else store.addTab(path, name, content)
    scheduleMarkdownDocumentIndex(path, name, content)
  } catch (error) {
    if (error instanceof Error && error.message === 'Not running in Tauri') { toast.error(t('common.unavailableInBrowser')); return }
    console.error('Open workspace file failed:', error); toast.error(describeFileOperationError(error, t('sidebar.openFile'))); refreshWorkspaces()
  }
}

async function openRememberedFile(file: { name: string; path: string }): Promise<void> {
  try {
    const store = useEditorStore.getState()
    const existing = store.tabs.find((tab) => isSameFilePath(tab.filePath, file.path))
    if (existing) { store.setActiveTab(existing.id); return }
    assertSupportedMarkdownFileSize(await getRememberedTextFileSize(file.path))
    const content = await readRememberedFile(file.path)
    store.addTab(file.path, file.name, content)
    scheduleMarkdownDocumentIndex(file.path, file.name, content)
  } catch (error) {
    if (error instanceof Error && error.message === 'Not running in Tauri') { toast.error(t('common.unavailableInBrowser')); return }
    toast.error(describeFileOperationError(error, t('sidebar.recentFiles')))
  }
}
</script>

<template>
  <aside v-if="collapsed" class="gm-vue-sidebar gm-vue-sidebar--collapsed">
    <button type="button" :title="t('sidebar.expand')" :aria-label="t('sidebar.expand')" data-product-tour="sidebar-toggle" @click="toggleSidebar"><Menu :size="20" aria-hidden="true" /></button>
    <button type="button" :title="t('sidebar.openFile')" :aria-label="t('sidebar.openFile')" data-product-tour="open-file" @click="openStandaloneFile"><FolderOpen :size="20" aria-hidden="true" /></button>
    <button type="button" :title="t('common.search')" :aria-label="t('common.search')" @click="onOpenSearch"><Search :size="20" aria-hidden="true" /></button>
    <button type="button" :title="t('sidebar.openFolder')" :aria-label="t('sidebar.openFolder')" data-product-tour="open-folder" @click="openFolder"><FolderUp :size="20" aria-hidden="true" /></button>
    <span></span><button type="button" :title="t('common.settings')" :aria-label="t('common.settings')" data-product-tour="settings" @click="onOpenSettings"><Settings2 :size="20" aria-hidden="true" /></button>
  </aside>
  <aside v-else class="gm-vue-sidebar" :style="{ width: `${width}px` }">
    <div class="gm-vue-sidebar__resize" @mousedown="onResizeStart"></div>
    <header><span>{{ t('sidebar.title') }}</span><button type="button" :title="t('sidebar.collapse')" :aria-label="t('sidebar.collapse')" @click="toggleSidebar"><PanelLeftClose :size="16" aria-hidden="true" /></button></header>
    <div class="gm-vue-sidebar__content">
      <template v-if="isTauri()">
        <Panel :header="t('sidebar.recentFiles')" toggleable :collapsed="false"><VueFileList :files="recentFiles" kind="recent" :on-open="openRememberedFile" :on-refresh-workspace="refreshWorkspaces" /></Panel>
        <Panel :header="t('sidebar.favorites')" toggleable collapsed><VueFileList :files="favoriteFiles" kind="favorite" :on-open="openRememberedFile" :on-refresh-workspace="refreshWorkspaces" /></Panel>
        <Panel :header="t('sidebar.workspace')" toggleable :collapsed="false"><VueWorkspaceRoots :on-open-file="openWorkspaceFile" /></Panel>
      </template>
      <div v-else class="gm-vue-sidebar__empty"><p>{{ t('common.localFilesUnavailable') }}</p><p>{{ t('common.downloadDesktop') }}</p></div>
    </div>
    <footer><button type="button" :title="t('sidebar.openFile')" :aria-label="t('sidebar.openFile')" @click="openStandaloneFile"><FolderOpen :size="17" aria-hidden="true" /></button><button type="button" :title="t('common.search')" :aria-label="t('common.search')" @click="onOpenSearch"><Search :size="17" aria-hidden="true" /></button><button type="button" :title="t('sidebar.openFolder')" :aria-label="t('sidebar.openFolder')" @click="openFolder"><FolderUp :size="17" aria-hidden="true" /></button><span></span><button type="button" :title="t('common.settings')" :aria-label="t('common.settings')" @click="onOpenSettings"><Settings2 :size="17" aria-hidden="true" /></button></footer>
  </aside>
</template>

<style scoped>
.gm-vue-sidebar { position: relative; display: flex; min-width: 0; flex: 0 0 auto; flex-direction: column; overflow: hidden; background: var(--gm-surface); border-right: 1px solid var(--gm-border); }.gm-vue-sidebar--collapsed { width: 56px; align-items: center; gap: 8px; padding: 12px 0; }.gm-vue-sidebar--collapsed > span { flex: 1; }.gm-vue-sidebar button { display: grid; padding: 5px; place-items: center; color: var(--gm-text-secondary); background: transparent; border: 0; border-radius: var(--gm-radius-sm); cursor: pointer; }.gm-vue-sidebar button:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-sidebar--collapsed button { width: 40px; height: 40px; }.gm-vue-sidebar__resize { position: absolute; top: 0; right: 0; bottom: 0; z-index: 2; width: 4px; cursor: col-resize; }.gm-vue-sidebar__resize:hover { background: color-mix(in srgb, var(--gm-primary) 30%, transparent); }.gm-vue-sidebar header { display: flex; height: 44px; align-items: center; padding: 0 16px; color: var(--gm-text); border-bottom: 1px solid var(--gm-border-subtle); font-size: 14px; font-weight: 700; }.gm-vue-sidebar header button { margin-left: auto; }.gm-vue-sidebar__content { display: grid; min-height: 0; flex: 1; align-content: start; gap: 8px; padding: 12px; overflow-y: auto; }.gm-vue-sidebar__empty { padding: 16px 8px; color: var(--gm-text-tertiary); font-size: 12px; text-align: center; }.gm-vue-sidebar__empty p + p { margin-top: 4px; color: var(--gm-text-disabled); }.gm-vue-sidebar footer { display: flex; align-items: center; gap: 4px; padding: 8px; background: color-mix(in srgb, var(--gm-surface) 86%, transparent); border-top: 1px solid var(--gm-border-subtle); }.gm-vue-sidebar footer span { flex: 1; }
</style>
