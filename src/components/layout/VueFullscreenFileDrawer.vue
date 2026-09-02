<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Panel from 'primevue/panel'
import { X } from 'lucide-vue-next'
import VueFileList from '@/components/file-tree/VueFileList.vue'
import VueWorkspaceRoots from '@/components/file-tree/VueWorkspaceRoots.vue'
import { isTauri } from '@/hooks/useTauri'
import { isWorkspaceDisplayFile } from '@/services/fileTree'
import { scheduleMarkdownDocumentIndex } from '@/services/rag/indexer'
import { isSameFilePath } from '@/services/pathIdentity'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { readRememberedFile } from '@/services/persistedFileAccess'
import { toast } from '@/services/toast'
import { useEditorStore } from '@/stores/editorStore'
import { useZustandSelector } from '@/composables/useZustandSelector'

const { t } = useI18n()
const props = defineProps<{ open: boolean; onClose: () => void; onOpenSearch: () => void }>()
const panel = ref<HTMLElement | null>(null)
const previousFocus = ref<HTMLElement | null>(null)
const tabs = useZustandSelector(useEditorStore, (state) => state.tabs)
const recentFiles = useZustandSelector(useEditorStore, (state) => state.recentFiles.filter((file) => isWorkspaceDisplayFile(file.path)))
const favorites = useZustandSelector(useEditorStore, (state) => state.favorites.filter(isWorkspaceDisplayFile))
const favoriteFiles = computed(() => favorites.value.map((path) => {
  const tab = tabs.value.find((item) => item.filePath === path)
  return { path, name: tab?.title || path.split(/[/\\]/).pop() || path }
}))

async function openByPath(file: { path: string; name: string }): Promise<void> {
  try {
    if (!isWorkspaceDisplayFile(file.path)) return
    const store = useEditorStore.getState()
    const existing = store.tabs.find((tab) => isSameFilePath(tab.filePath, file.path))
    if (existing) { store.setActiveTab(existing.id); return }
    const content = await readRememberedFile(file.path)
    store.addTab(file.path, file.name, content)
    scheduleMarkdownDocumentIndex(file.path, file.name, content)
  } catch (error) {
    if (error instanceof Error && error.message === 'Not running in Tauri') { toast.error(t('fullscreenDrawer.browserUnavailable')); return }
    console.error('Open fullscreen file failed:', error)
    toast.error(describeFileOperationError(error, t('fullscreenDrawer.openFileFailed')))
    window.dispatchEvent(new Event('guanmo:workspace-refresh'))
  }
}

function handlePointerDown(event: PointerEvent): void {
  const target = event.target as HTMLElement | null
  if (!target || panel.value?.contains(target) || target.closest('[data-fullscreen-control-bar]') || target.closest('.p-contextmenu')) return
  props.onClose()
}

function refreshWorkspaces(): void { window.dispatchEvent(new Event('guanmo:workspace-refresh')) }

watch(() => props.open, async (open) => {
  if (open) {
    previousFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick(); panel.value?.focus()
    document.addEventListener('pointerdown', handlePointerDown, true)
  } else {
    document.removeEventListener('pointerdown', handlePointerDown, true)
    previousFocus.value?.focus?.()
  }
}, { immediate: true })
onBeforeUnmount(() => document.removeEventListener('pointerdown', handlePointerDown, true))
</script>

<template>
  <div class="gm-vue-fullscreen-drawer" :class="{ 'gm-vue-fullscreen-drawer--open': open }" :aria-hidden="!open">
    <aside ref="panel" data-fullscreen-file-drawer="true" :tabindex="open ? -1 : undefined" role="dialog" aria-modal="false" :aria-label="t('fullscreenDrawer.ariaLabel')" @click.stop>
      <header><span>{{ t('fullscreenDrawer.title') }}</span><button type="button" :title="t('fullscreenDrawer.close')" :aria-label="t('fullscreenDrawer.close')" @click="onClose"><X :size="16" aria-hidden="true" /></button></header>
      <div class="gm-vue-fullscreen-drawer__content">
        <div v-if="!isTauri()" class="gm-vue-fullscreen-drawer__empty">{{ t('fullscreenDrawer.localFilesUnavailable') }}</div>
        <template v-else>
          <Panel :header="t('fullscreenDrawer.recentFiles')" toggleable :collapsed="false"><VueFileList :files="recentFiles" kind="recent" :on-open="openByPath" :on-refresh-workspace="refreshWorkspaces" /></Panel>
          <Panel :header="t('fullscreenDrawer.favorites')" toggleable collapsed><VueFileList :files="favoriteFiles" kind="favorite" :on-open="openByPath" :on-refresh-workspace="refreshWorkspaces" /></Panel>
          <Panel :header="t('fullscreenDrawer.workspace')" toggleable :collapsed="false"><VueWorkspaceRoots :on-open-file="(path) => openByPath({ path, name: path.split(/[/\\]/).pop() || 'untitled.md' })" /></Panel>
        </template>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.gm-vue-fullscreen-drawer { position: fixed; inset: 0; z-index: 44; pointer-events: none; opacity: 0; transition: opacity .15s ease-out; }.gm-vue-fullscreen-drawer--open { pointer-events: auto; opacity: 1; }.gm-vue-fullscreen-drawer aside { position: absolute; top: 48px; left: 12px; display: flex; width: min(292px, calc(100vw - 24px)); min-height: 200px; max-height: calc(100vh - 60px); flex-direction: column; overflow: hidden; background: var(--gm-surface); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); box-shadow: var(--gm-shadow-lg); outline: 0; opacity: 0; pointer-events: none; transform: translateX(-16px); transition: opacity .18s ease-out, transform .18s ease-out; }.gm-vue-fullscreen-drawer--open aside { opacity: 1; pointer-events: auto; transform: translateX(0); }.gm-vue-fullscreen-drawer header { display: flex; height: 44px; align-items: center; padding: 0 16px; color: var(--gm-text); border-bottom: 1px solid var(--gm-border-subtle); font-size: 14px; font-weight: 700; }.gm-vue-fullscreen-drawer header button { display: grid; margin-left: auto; padding: 4px; place-items: center; color: var(--gm-text-secondary); background: transparent; border: 0; border-radius: var(--gm-radius-sm); cursor: pointer; }.gm-vue-fullscreen-drawer header button:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-fullscreen-drawer__content { display: grid; min-height: 0; gap: 8px; padding: 12px; overflow-y: auto; }.gm-vue-fullscreen-drawer__empty { padding: 16px 8px; color: var(--gm-text-tertiary); font-size: 12px; text-align: center; }
</style>
