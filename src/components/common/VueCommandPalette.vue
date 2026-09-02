<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import { Search } from 'lucide-vue-next'
import { useAppStore } from '@/stores/appStore'
import { useEditorStore } from '@/stores/editorStore'
import { openFile, saveFile, saveFileAs } from '@/services/fileSystem'
import { exportMarkdownAsHtml } from '@/services/markdownExport'
import { scheduleMarkdownDocumentIndex } from '@/services/rag/indexer'
import { SHORTCUTS } from '@/services/shortcuts'
import { isSameFilePath } from '@/services/pathIdentity'
import { toast } from '@/services/toast'

type Command = { id: string; label: string; shortcut?: string; category?: string; action: () => void | Promise<void> }
const props = withDefaults(defineProps<{ open: boolean; onClose: () => void; mode?: 'commands' | 'files' }>(), { mode: 'commands' })
const query = ref('')
const selectedIndex = ref(0)
const inputWrapper = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)
const { t } = useI18n()

function shortcut(id: string): string | undefined { return SHORTCUTS.find((item) => item.id === id)?.key }
function close(): void { props.onClose() }
async function openFileCommand(): Promise<void> {
  close()
  try {
    const file = await openFile(); if (!file) return
    const store = useEditorStore.getState(); const existing = store.tabs.find((tab) => isSameFilePath(tab.filePath, file.path))
    if (existing) store.setActiveTab(existing.id); else store.addTab(file.path, file.name, file.content)
    scheduleMarkdownDocumentIndex(file.path, file.name, file.content)
  } catch (error) { console.error('Open file failed:', error) }
}
async function saveFileCommand(): Promise<void> {
  close(); const store = useEditorStore.getState(); const tab = store.tabs.find((item) => item.id === store.activeTabId); if (!tab) return
  try {
    if (tab.filePath) { await saveFile(tab.filePath, tab.content); scheduleMarkdownDocumentIndex(tab.filePath, tab.title, tab.content); store.markTabSaved(tab.id, tab.content) }
    else { const result = await saveFileAs(tab.content); if (result) { scheduleMarkdownDocumentIndex(result.path, result.name, result.content); store.saveTabAs(tab.id, result.path, result.name, result.content) } }
    toast.success(t('common.save'))
  } catch (error) { console.error('Save failed:', error); toast.error(t('common.save')) }
}
async function exportHtml(): Promise<void> {
  close(); const store = useEditorStore.getState(); const tab = store.tabs.find((item) => item.id === store.activeTabId); if (!tab) return
  try { const result = await exportMarkdownAsHtml(tab.content, tab.title.replace(/\.(md|markdown|mdx)$/i, ''), tab.filePath); if (result) toast.success(t('tabbar.exportHtml')) }
  catch (error) { toast.error(error instanceof Error ? error.message : 'HTML export failed') }
}
const commands = computed<Command[]>(() => [
  { id: 'new-file', label: t('commandPalette.newFile'), shortcut: shortcut('new-file'), category: t('commandPalette.file'), action: () => { useEditorStore.getState().addTab(undefined, 'untitled.md'); close() } },
  { id: 'open-file', label: t('commandPalette.openFile'), shortcut: shortcut('open-file'), category: t('commandPalette.file'), action: openFileCommand },
  { id: 'save-file', label: t('commandPalette.saveFile'), shortcut: shortcut('save-file'), category: t('commandPalette.file'), action: saveFileCommand },
  { id: 'export-html', label: t('commandPalette.exportHtml'), shortcut: shortcut('export-html'), category: t('commandPalette.file'), action: exportHtml },
  { id: 'toggle-preview', label: t('commandPalette.togglePreview'), shortcut: shortcut('toggle-preview'), category: t('commandPalette.view'), action: () => { useEditorStore.getState().togglePreview(); close() } },
  { id: 'toggle-diff', label: t('commandPalette.toggleDiff'), shortcut: shortcut('toggle-diff'), category: t('commandPalette.view'), action: () => { useEditorStore.getState().toggleDiffPreview(); close() } },
  { id: 'view-edit', label: t('commandPalette.viewEdit'), shortcut: shortcut('view-edit'), category: t('commandPalette.view'), action: () => { useEditorStore.getState().setViewMode('edit'); close() } },
  { id: 'view-preview', label: t('commandPalette.viewPreview'), shortcut: shortcut('view-preview'), category: t('commandPalette.view'), action: () => { useEditorStore.getState().setViewMode('preview'); close() } },
  { id: 'view-edit-preview', label: t('commandPalette.viewEditPreview'), shortcut: shortcut('view-edit-preview'), category: t('commandPalette.view'), action: () => { useEditorStore.getState().setViewMode('edit-preview'); close() } },
  { id: 'view-dual-preview', label: t('commandPalette.viewDualPreview'), shortcut: shortcut('view-dual-preview'), category: t('commandPalette.view'), action: () => { useEditorStore.getState().setViewMode('dual-preview'); close() } },
  { id: 'view-diff-preview', label: t('commandPalette.viewDiffPreview'), shortcut: shortcut('view-diff-preview'), category: t('commandPalette.view'), action: () => { useEditorStore.getState().setViewMode('diff-preview'); close() } },
  { id: 'toggle-sidebar', label: t('commandPalette.toggleSidebar'), shortcut: shortcut('toggle-sidebar'), category: t('commandPalette.view'), action: () => { useAppStore.getState().toggleSidebar(); close() } },
  { id: 'toggle-ai', label: t('commandPalette.toggleAi'), shortcut: shortcut('toggle-ai'), category: t('commandPalette.view'), action: () => { useAppStore.getState().toggleAiPanel(); close() } },
])
const filtered = computed(() => commands.value.filter((command) => command.label.toLowerCase().includes(query.value.toLowerCase()) || command.category?.toLowerCase().includes(query.value.toLowerCase())))
function execute(command: Command): void { void command.action() }
function keydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') { event.preventDefault(); selectedIndex.value = Math.min(selectedIndex.value + 1, filtered.value.length - 1) }
  else if (event.key === 'ArrowUp') { event.preventDefault(); selectedIndex.value = Math.max(selectedIndex.value - 1, 0) }
  else if (event.key === 'Enter') { event.preventDefault(); const command = filtered.value[selectedIndex.value]; if (command) execute(command) }
  else if (event.key === 'Escape') { event.preventDefault(); close() }
}
watch(() => props.open, async (open) => { if (!open) return; query.value = ''; selectedIndex.value = 0; await nextTick(); inputWrapper.value?.querySelector('input')?.focus() })
watch(query, () => { selectedIndex.value = 0 })
watch(selectedIndex, async () => { await nextTick(); (list.value?.children[selectedIndex.value] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' }) })
</script>

<template>
  <div v-if="open" class="gm-vue-command-palette" @keydown="keydown">
    <button class="gm-vue-command-palette__mask" type="button" :aria-label="t('commandPalette.close')" @click="close"></button>
    <section role="dialog" aria-modal="true" :aria-label="t('commandPalette.title')">
      <div ref="inputWrapper" class="gm-vue-command-palette__input"><Search :size="16" aria-hidden="true" /><InputText v-model="query" :placeholder="mode === 'files' ? t('commandPalette.searchFiles') : t('commandPalette.searchCommands')" @keydown="keydown" /><kbd>ESC</kbd></div>
      <div ref="list" class="gm-vue-command-palette__list"><div v-if="!filtered.length" class="gm-vue-command-palette__empty">{{ t('commandPalette.noMatch') }}</div><button v-for="(command, index) in filtered" :key="command.id" type="button" :class="{ 'gm-vue-command-palette__item--selected': selectedIndex === index }" @mouseenter="selectedIndex = index" @click="execute(command)"><span>{{ command.category }}</span><strong>{{ command.label }}</strong><kbd v-if="command.shortcut">{{ command.shortcut }}</kbd></button></div>
    </section>
  </div>
</template>

<style scoped>
.gm-vue-command-palette { position: fixed; inset: 0; z-index: 50; display: flex; justify-content: center; padding-top: 15vh; }.gm-vue-command-palette__mask { position: absolute; inset: 0; background: rgb(0 0 0 / .2); border: 0; }.gm-vue-command-palette section { position: relative; width: min(560px, calc(100vw - 32px)); max-height: 400px; overflow: hidden; color: var(--gm-text); background: var(--gm-surface); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); box-shadow: var(--gm-shadow-lg); }.gm-vue-command-palette__input { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--gm-border-subtle); }.gm-vue-command-palette__input :deep(input) { min-width: 0; flex: 1; }.gm-vue-command-palette kbd { padding: 2px 7px; color: var(--gm-text-tertiary); background: var(--gm-surface-elevated); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-sm); font-family: monospace; font-size: 10px; }.gm-vue-command-palette__list { max-height: 320px; padding: 8px; overflow-y: auto; }.gm-vue-command-palette__list button { display: grid; width: 100%; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 9px 10px; color: var(--gm-text-secondary); background: transparent; border: 0; border-radius: var(--gm-radius-md); cursor: pointer; text-align: left; }.gm-vue-command-palette__list button:hover,.gm-vue-command-palette__item--selected { color: var(--gm-text) !important; background: var(--gm-primary-subtle) !important; }.gm-vue-command-palette__list span { color: var(--gm-text-tertiary); font-size: 11px; font-weight: 700; }.gm-vue-command-palette__list strong { overflow: hidden; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }.gm-vue-command-palette__empty { padding: 32px 16px; color: var(--gm-text-secondary); font-size: 12px; text-align: center; }
</style>
