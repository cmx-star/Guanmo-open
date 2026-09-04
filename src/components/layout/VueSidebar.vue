<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Panel from 'primevue/panel'
import VueFileList from '@/components/file-tree/VueFileList.vue'
import VueWorkspaceRoots from '@/components/file-tree/VueWorkspaceRoots.vue'
import { useEditorStore } from '@/stores/editorStore'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { getTextFileSize, isTauri, readFile } from '@/hooks/useTauri'
import { scheduleMarkdownDocumentIndex } from '@/services/rag/indexer'
import { isWorkspaceDisplayFile } from '@/services/fileTree'
import { isSameFilePath } from '@/services/pathIdentity'
import { toast } from '@/services/toast'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { getRememberedTextFileSize, readRememberedFile } from '@/services/persistedFileAccess'
import { assertSupportedMarkdownFileSize } from '@/services/fileSizeLimit'

defineProps<{
  width: number
  onResizeStart: (event: MouseEvent) => void
}>()
const { t } = useI18n()
const recentFiles = useZustandSelector(useEditorStore, (state) => state.recentFiles.filter((file) => isWorkspaceDisplayFile(file.path)))
const favorites = useZustandSelector(useEditorStore, (state) => state.favorites.filter(isWorkspaceDisplayFile))
const tabs = useZustandSelector(useEditorStore, (state) => state.tabs)
const favoriteFiles = computed(() => favorites.value.map((path) => {
  const tab = tabs.value.find((item) => item.filePath === path)
  return { path, name: tab?.title || path.split(/[/\\]/).pop() || path }
}))

function refreshWorkspaces(): void { window.dispatchEvent(new Event('guanmo:workspace-refresh')) }

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
  <aside class="gm-vue-sidebar" :style="{ width: `${width}px` }">
    <div class="gm-vue-sidebar__resize" @mousedown="onResizeStart"></div>
    <header><span>{{ t('sidebar.title') }}</span></header>
    <div class="gm-vue-sidebar__content">
      <template v-if="isTauri()">
        <Panel :header="t('sidebar.recentFiles')" toggleable :collapsed="false"><VueFileList :files="recentFiles" kind="recent" :on-open="openRememberedFile" :on-refresh-workspace="refreshWorkspaces" /></Panel>
        <Panel :header="t('sidebar.favorites')" toggleable collapsed><VueFileList :files="favoriteFiles" kind="favorite" :on-open="openRememberedFile" :on-refresh-workspace="refreshWorkspaces" /></Panel>
        <Panel :header="t('sidebar.workspace')" toggleable :collapsed="false"><VueWorkspaceRoots :on-open-file="openWorkspaceFile" /></Panel>
      </template>
      <div v-else class="gm-vue-sidebar__empty"><p>{{ t('common.localFilesUnavailable') }}</p><p>{{ t('common.downloadDesktop') }}</p></div>
    </div>
  </aside>
</template>

<style scoped>
.gm-vue-sidebar { position: relative; display: flex; min-width: 0; flex: 0 0 auto; flex-direction: column; overflow: hidden; background: var(--gm-surface); border-right: 1px solid var(--gm-border); }
.gm-vue-sidebar__resize { position: absolute; top: 0; right: 0; bottom: 0; z-index: 2; width: 4px; cursor: col-resize; }
.gm-vue-sidebar__resize:hover { background: color-mix(in srgb, var(--gm-primary) 30%, transparent); }
.gm-vue-sidebar header { display: flex; height: 40px; flex: 0 0 auto; align-items: center; padding: 0 16px; color: var(--gm-text-secondary); border-bottom: 1px solid var(--gm-border-subtle); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.gm-vue-sidebar__content { display: grid; min-height: 0; flex: 1; align-content: start; gap: 8px; padding: 12px; overflow-y: auto; }
.gm-vue-sidebar__empty { padding: 16px 8px; color: var(--gm-text-tertiary); font-size: 12px; text-align: center; }
.gm-vue-sidebar__empty p + p { margin-top: 4px; color: var(--gm-text-disabled); }
</style>
