<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Bot, ChevronLeft, Eye, GitCompareArrows, LayoutPanelTop, Maximize2, Palette, PanelLeft, PanelTop, PencilLine, Pin, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { FULLSCREEN_CONTENT_PADDING, type ThemeId, useSettingsStore } from '@/stores/settingsStore'
import { useAppStore } from '@/stores/appStore'
import { useEditorStore, type Tab, type ViewMode } from '@/stores/editorStore'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { useVueFileRename } from '@/composables/useVueFileRename'
import { addFileContextTag, summarizeFileWithAi } from '@/services/aiContext'
import { addKnowledgeDocument, isKnowledgeDocumentIndexed } from '@/services/rag/knowledgeBase'
import { isMarkdownPath } from '@/services/rag/indexer'
import { isSameFilePath } from '@/services/pathIdentity'
import { saveTabAsFile } from '@/services/fileEntryActions'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { toast } from '@/services/toast'

const props = defineProps<{ fileDrawerOpen: boolean; onToggleFileDrawer: () => void; onCloseFileDrawer: () => void; onExitFullscreen: () => void }>()
const { t } = useI18n()
const tabs = useZustandSelector(useEditorStore, (state) => state.tabs)
const activeTabId = useZustandSelector(useEditorStore, (state) => state.activeTabId)
const viewMode = useZustandSelector(useEditorStore, (state) => state.viewMode)
const favorites = useZustandSelector(useEditorStore, (state) => state.favorites)
const aiPanelOpen = useZustandSelector(useAppStore, (state) => state.aiPanelOpen)
const themeId = useZustandSelector(useSettingsStore, (state) => state.appearance.themeId)
const fullscreenContentPadding = useZustandSelector(useSettingsStore, (state) => state.editor.fullscreenContentPadding)
const visible = ref(false)
const tabMode = ref(false)
const paddingOpen = ref(false)
const themeOpen = ref(false)
const menu = ref<{ x: number; y: number; tabId: string } | null>(null)
const kbStatus = ref<'idle' | 'checking' | 'not-indexed' | 'indexed' | 'adding'>('idle')
const rename = useVueFileRename()
let hideTimer: number | undefined
let paddingTimer: number | undefined
let pointerWithin = false

const modes: Array<{ key: ViewMode; label: string; icon: typeof PencilLine }> = [
  { key: 'edit', label: 'fullscreen.edit', icon: PencilLine }, { key: 'preview', label: 'fullscreen.preview', icon: Eye }, { key: 'edit-preview', label: 'fullscreen.split', icon: PanelLeft }, { key: 'dual-preview', label: 'fullscreen.compare', icon: LayoutPanelTop }, { key: 'diff-preview', label: 'fullscreen.diff', icon: GitCompareArrows },
]
const themes: Array<{ key: ThemeId; label: string }> = [{ key: 'warm', label: 'fullscreen.themeWarm' }, { key: 'light', label: 'fullscreen.themeLight' }, { key: 'dark', label: 'fullscreen.themeDark' }, { key: 'paper', label: 'fullscreen.themePaper' }, { key: 'github-light', label: 'fullscreen.themeGithub' }]
const sortedTabs = computed(() => [...tabs.value].sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned))))
const contextTab = computed(() => menu.value ? tabs.value.find((tab) => tab.id === menu.value?.tabId) ?? null : null)

function clearHide(): void { window.clearTimeout(hideTimer) }
function show(): void { clearHide(); visible.value = true }
function scheduleHide(): void { if (props.fileDrawerOpen || paddingOpen.value || themeOpen.value) return; clearHide(); hideTimer = window.setTimeout(() => { visible.value = false; if (!menu.value) tabMode.value = false }, tabMode.value ? 2200 : 700) }
function handleEnter(): void { pointerWithin = true; show() }
function handleLeave(): void { pointerWithin = false; scheduleHide() }
function closeTabs(): void { clearHide(); if (props.fileDrawerOpen) { props.onCloseFileDrawer(); return }; tabMode.value = false; visible.value = true }
function toggleTabs(): void { clearHide(); show(); tabMode.value = !tabMode.value }
function togglePadding(): void { clearHide(); show(); themeOpen.value = false; paddingOpen.value = !paddingOpen.value }
function toggleTheme(): void { clearHide(); show(); paddingOpen.value = false; themeOpen.value = !themeOpen.value }
function setMode(mode: ViewMode): void { useEditorStore.getState().setViewMode(mode) }
function setActiveTab(tabId: string): void { useEditorStore.getState().setActiveTab(tabId) }
function closeTab(tabId: string): void { useEditorStore.getState().closeTab(tabId) }
function updatePadding(value: string): void { window.clearTimeout(paddingTimer); const next = Math.round(Number(value)); paddingTimer = window.setTimeout(() => useSettingsStore.getState().updateEditorSettings({ fullscreenContentPadding: next }), 150) }
function setTheme(theme: ThemeId): void { useSettingsStore.getState().updateAppearanceSettings({ themeId: theme }) }
function toggleAi(): void { useAppStore.getState().toggleAiPanel() }

function openMenu(event: MouseEvent, tabId: string): void {
  event.preventDefault(); show(); menu.value = { x: event.clientX, y: event.clientY, tabId }
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab?.filePath || !isMarkdownPath(tab.filePath)) { kbStatus.value = 'idle'; return }
  kbStatus.value = 'checking'
  void isKnowledgeDocumentIndexed(tab.filePath).then((indexed) => { kbStatus.value = indexed ? 'indexed' : 'not-indexed' }).catch(() => { kbStatus.value = 'not-indexed' })
}
async function runAction(action: string): Promise<void> {
  const tab = contextTab.value
  if (!tab) return
  menu.value = null
  const editor = useEditorStore.getState()
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
    case 'openInRightPane': editor.setRightPaneTabId(tab.id); if (editor.viewMode !== 'dual-preview') editor.setViewMode('dual-preview'); break
    case 'pinTab': editor.togglePinTab(tab.id); break
    case 'rename': if (tab.filePath) { tabMode.value = true; rename.startRename(tab.id, tab.title) }; break
    case 'saveAs': await saveTabAsFile(tab).then(() => toast.success(t('tabbar.saveAs'))).catch((error) => toast.error(describeFileOperationError(error, t('tabbar.saveAs')))); break
    case 'addToKb': case 'updateKb': if (!tab.filePath) return; kbStatus.value = 'adding'; await addKnowledgeDocument({ filePath: tab.filePath, title: tab.title, content: tab.content }).then((result) => { kbStatus.value = result.success ? 'indexed' : 'not-indexed'; result.success ? toast.success(t('tabbar.addToKnowledgeBase')) : toast.error(result.error || t('tabbar.addToKnowledgeBase')) }).catch((error) => { kbStatus.value = 'not-indexed'; toast.error(error instanceof Error ? error.message : t('tabbar.addToKnowledgeBase')) }); break
  }
}
function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || document.querySelector('[data-editor-search-overlay]')) return
  if (menu.value) { event.preventDefault(); event.stopPropagation(); menu.value = null; return }
  if (paddingOpen.value || themeOpen.value) { event.preventDefault(); event.stopPropagation(); paddingOpen.value = false; themeOpen.value = false; return }
  if (props.fileDrawerOpen) { const target = event.target as HTMLElement | null; if (target?.closest('[data-fullscreen-file-drawer] input')) return; event.preventDefault(); event.stopPropagation(); props.onCloseFileDrawer(); return }
  if (tabMode.value) { event.preventDefault(); event.stopPropagation(); closeTabs(); return }
  if (aiPanelOpen.value) { event.preventDefault(); event.stopPropagation(); useAppStore.getState().closeAiPanel(); return }
  event.preventDefault(); event.stopPropagation(); props.onExitFullscreen()
}
function handleOutside(event: PointerEvent): void { const target = event.target as HTMLElement | null; if (target?.closest('[data-fullscreen-control-bar], .gm-vue-fullscreen-menu')) return; paddingOpen.value = false; themeOpen.value = false; menu.value = null }

watch(() => props.fileDrawerOpen, (open) => { clearHide(); if (open) { visible.value = true; tabMode.value = true } else if (!menu.value) tabMode.value = false })
watch([visible, () => props.fileDrawerOpen, paddingOpen, themeOpen], () => { if (visible.value && !props.fileDrawerOpen && !paddingOpen.value && !themeOpen.value && !pointerWithin) scheduleHide() })
window.addEventListener('keydown', handleKeydown, true)
window.addEventListener('pointerdown', handleOutside, true)
onBeforeUnmount(() => { clearHide(); window.clearTimeout(paddingTimer); window.removeEventListener('keydown', handleKeydown, true); window.removeEventListener('pointerdown', handleOutside, true) })
</script>

<template>
  <div class="gm-vue-fullscreen-trigger" @mouseenter="handleEnter" @mouseleave="handleLeave"></div>
  <div data-fullscreen-control-bar="true" class="gm-vue-fullscreen-control" :data-visible="visible" @mouseenter="handleEnter" @mouseleave="handleLeave">
    <div class="gm-vue-fullscreen-control__shell">
      <div v-if="!tabMode" class="gm-vue-fullscreen-control__primary">
        <div class="gm-vue-fullscreen-control__group"><button type="button" :data-active="fileDrawerOpen" :title="t('fullscreen.tabsAndFiles')" @click="props.onToggleFileDrawer"><PanelTop :size="16" aria-hidden="true" /><span>{{ t('fullscreen.tabs') }}</span></button><i></i><button v-for="mode in modes" :key="mode.key" type="button" :data-active="viewMode === mode.key" :title="t(mode.label)" @click="setMode(mode.key)"><component :is="mode.icon" :size="16" aria-hidden="true" /><span>{{ t(mode.label) }}</span></button></div>
        <div class="gm-vue-fullscreen-control__group"><i></i><button type="button" :data-active="aiPanelOpen" :title="t('desktop.toggleAssistant')" @click="toggleAi"><Bot :size="16" aria-hidden="true" /><span>AI</span></button><button type="button" :data-active="paddingOpen" :title="t('fullscreen.padding')" :aria-expanded="paddingOpen" @click="togglePadding"><PanelLeft :size="16" aria-hidden="true" /><span>{{ t('fullscreen.padding') }}</span></button><button type="button" :data-active="themeOpen" :title="t('fullscreen.theme')" :aria-expanded="themeOpen" @click="toggleTheme"><Palette :size="16" aria-hidden="true" /><span>{{ t('fullscreen.theme') }}</span></button><button type="button" :title="t('fullscreen.exit')" @click="props.onExitFullscreen"><Maximize2 :size="16" aria-hidden="true" /><span>{{ t('fullscreen.exit') }}</span></button></div>
      </div>
      <div v-else class="gm-vue-fullscreen-control__tabs"><button type="button" :title="t('fullscreen.back')" :aria-label="t('fullscreen.back')" @click="closeTabs"><ChevronLeft :size="19" aria-hidden="true" /></button><div><button v-for="tab in sortedTabs" :key="tab.id" type="button" class="gm-vue-fullscreen-control__tab" :data-active="tab.id === activeTabId" :title="tab.title" @click="setActiveTab(tab.id)" @contextmenu="openMenu($event, tab.id)"><input v-if="rename.isRenaming(tab.id)" autofocus :value="rename.state.value" :disabled="rename.isSubmitting.value" @click.stop @input="rename.setRenameValue(($event.target as HTMLInputElement).value)" @blur="tab.filePath && rename.submitRename(tab.id, tab.filePath)" @keydown.enter.stop.prevent="tab.filePath && rename.submitRename(tab.id, tab.filePath)" @keydown.esc.stop="rename.cancelRename(tab.id)" /><template v-else><span>{{ tab.title }}</span><Pin v-if="tab.pinned" :size="12" aria-hidden="true" /><i v-if="tab.filePath && favorites.some((path) => isSameFilePath(path, tab.filePath!))" class="gm-vue-fullscreen-control__favorite">*</i><i v-if="tab.modified" class="gm-vue-fullscreen-control__modified"></i></template><button type="button" :title="t('tabbar.close')" :aria-label="t('tabbar.close')" @click.stop="closeTab(tab.id)"><X :size="13" aria-hidden="true" /></button></button></div></div>
      <section v-if="paddingOpen" class="gm-vue-fullscreen-card" role="dialog" :aria-label="t('fullscreen.padding')"><h3>{{ t('fullscreen.padding') }}</h3><p>{{ t('fullscreen.paddingDescription') }}</p><div><input type="range" :min="FULLSCREEN_CONTENT_PADDING.min" :max="FULLSCREEN_CONTENT_PADDING.max" :step="FULLSCREEN_CONTENT_PADDING.step" :value="fullscreenContentPadding" :aria-label="t('fullscreen.padding')" @input="updatePadding(($event.target as HTMLInputElement).value)" /><output>{{ fullscreenContentPadding }}px</output></div><footer><span>{{ t('fullscreen.compact') }}</span><span>{{ t('fullscreen.relaxed') }}</span></footer></section>
      <section v-if="themeOpen" class="gm-vue-fullscreen-card" role="dialog" :aria-label="t('fullscreen.theme')"><h3>{{ t('fullscreen.theme') }}</h3><p>{{ t('fullscreen.themeDescription') }}</p><div class="gm-vue-fullscreen-card__themes" role="radiogroup" :aria-label="t('fullscreen.theme')"><button v-for="theme in themes" :key="theme.key" type="button" role="radio" :aria-checked="themeId === theme.key" :data-active="themeId === theme.key" @click="setTheme(theme.key)">{{ t(theme.label) }}</button></div></section>
    </div>
  </div>
  <div v-if="menu && contextTab" class="gm-vue-fullscreen-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"><strong>{{ t('tabbar.operations') }}</strong><button type="button" @click="runAction('pinTab')">{{ contextTab.pinned ? t('tabbar.unpin') : t('tabbar.pin') }}</button><button type="button" @click="runAction('openInRightPane')">{{ t('tabbar.openInRight') }}</button><button type="button" :disabled="!contextTab.filePath" @click="runAction('rename')">{{ t('tabbar.rename') }}</button><button type="button" @click="runAction('saveAs')">{{ t('tabbar.saveAs') }}</button><strong>{{ t('tabbar.assistant') }}</strong><button type="button" @click="runAction('aiSummarize')">{{ t('tabbar.summarize') }}</button><button type="button" @click="runAction('addToAi')">{{ t('tabbar.addToContext') }}</button><strong>{{ t('tabbar.copyAndIndex') }}</strong><button type="button" @click="runAction('copyContent')">{{ t('tabbar.copyContent') }}</button><button v-if="contextTab.filePath" type="button" @click="runAction('copyPath')">{{ t('tabbar.copyPath') }}</button><button v-if="contextTab.filePath" type="button" @click="runAction('revealFile')">{{ t('tabbar.revealFile') }}</button><template v-if="contextTab.filePath && isMarkdownPath(contextTab.filePath)"><strong>{{ t('tabbar.knowledgeBase') }}</strong><button v-if="kbStatus === 'not-indexed'" type="button" @click="runAction('addToKb')">{{ t('tabbar.addToKnowledgeBase') }}</button><button v-else-if="kbStatus === 'indexed'" type="button" @click="runAction('updateKb')">{{ t('tabbar.updateKnowledgeBase') }}</button><button v-else type="button" disabled>{{ kbStatus === 'adding' ? t('tabbar.addingKnowledgeBase') : t('tabbar.readingKnowledgeBase') }}</button></template><strong>{{ t('tabbar.closeTabs') }}</strong><button type="button" @click="runAction('close')">{{ t('tabbar.close') }}</button><button type="button" @click="runAction('closeOthers')">{{ t('tabbar.closeOthers') }}</button><button type="button" @click="runAction('closeRight')">{{ t('tabbar.closeRight') }}</button><button type="button" @click="runAction('closeAll')">{{ t('tabbar.closeAll') }}</button></div>
</template>

<style scoped>
.gm-vue-fullscreen-trigger { position: fixed; z-index: 40; top: 0; left: 50%; width: min(960px, calc(100vw - 32px)); height: 36px; transform: translateX(-50%); }.gm-vue-fullscreen-control { position: fixed; z-index: 50; top: 16px; left: 50%; max-width: calc(100vw - 32px); opacity: 0; pointer-events: none; transform: translate(-50%, -6px); transition: opacity var(--gm-duration-base), transform var(--gm-duration-base); }.gm-vue-fullscreen-control[data-visible='true'] { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }.gm-vue-fullscreen-control__shell { position: relative; max-width: min(960px, calc(100vw - 32px)); overflow: visible; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); background: color-mix(in srgb, var(--gm-surface) 92%, transparent); box-shadow: var(--gm-shadow-md); backdrop-filter: blur(12px); }.gm-vue-fullscreen-control__primary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; }.gm-vue-fullscreen-control__group, .gm-vue-fullscreen-control__tabs, .gm-vue-fullscreen-control__tabs > div { display: flex; min-width: 0; align-items: center; gap: 4px; }.gm-vue-fullscreen-control__group { overflow-x: auto; }.gm-vue-fullscreen-control__group i { width: 1px; height: 18px; flex: 0 0 auto; margin: 0 4px; background: var(--gm-border-subtle); }.gm-vue-fullscreen-control button { display: inline-flex; min-height: 30px; align-items: center; gap: 5px; padding: 5px 8px; border: 0; border-radius: var(--gm-radius-md); color: var(--gm-text-secondary); background: transparent; font-size: var(--gm-text-sm); cursor: pointer; white-space: nowrap; }.gm-vue-fullscreen-control button:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-fullscreen-control button[data-active='true'] { color: var(--gm-primary); background: var(--gm-primary-subtle); }.gm-vue-fullscreen-control__tabs { width: min(900px, calc(100vw - 56px)); padding: 8px 10px; }.gm-vue-fullscreen-control__tabs > div { flex: 1; padding: 0 2px; overflow-x: auto; }.gm-vue-fullscreen-control__tab { max-width: 300px; font-weight: 700; }.gm-vue-fullscreen-control__tab > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.gm-vue-fullscreen-control__tab[data-active='true'] { color: var(--gm-primary); text-decoration: underline; text-underline-offset: 4px; }.gm-vue-fullscreen-control__tab input { width: 128px; border: 1px solid var(--gm-primary); border-radius: var(--gm-radius-sm); color: var(--gm-text); background: var(--gm-canvas); outline: none; }.gm-vue-fullscreen-control__tab > button { min-height: auto; margin-left: 2px; padding: 2px; opacity: .65; }.gm-vue-fullscreen-control__tab:hover > button { opacity: 1; }.gm-vue-fullscreen-control__favorite { color: var(--gm-warning); font-style: normal; }.gm-vue-fullscreen-control__modified { width: 7px; height: 7px; border-radius: 50%; background: var(--gm-primary); }.gm-vue-fullscreen-card { position: absolute; top: calc(100% + 10px); left: 50%; width: min(340px, calc(100vw - 32px)); padding: 16px; transform: translateX(-50%); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); background: var(--gm-surface); box-shadow: var(--gm-shadow-md); }.gm-vue-fullscreen-card h3 { margin: 0; color: var(--gm-text); font-size: var(--gm-text-base); }.gm-vue-fullscreen-card p { margin: 4px 0 12px; color: var(--gm-text-tertiary); font-size: var(--gm-text-sm); }.gm-vue-fullscreen-card > div:first-of-type { display: flex; align-items: center; gap: 12px; }.gm-vue-fullscreen-card input[type='range'] { width: 100%; accent-color: var(--gm-primary); }.gm-vue-fullscreen-card output { width: 52px; color: var(--gm-text-secondary); font-family: var(--gm-font-mono); font-size: var(--gm-text-sm); text-align: right; }.gm-vue-fullscreen-card footer { display: flex; justify-content: space-between; margin-top: 4px; color: var(--gm-text-tertiary); font-size: var(--gm-text-xs); }.gm-vue-fullscreen-card__themes { display: flex; flex-wrap: wrap; gap: 6px; }.gm-vue-fullscreen-card__themes button { border: 1px solid var(--gm-border); }.gm-vue-fullscreen-card__themes button[data-active='true'] { border-color: var(--gm-primary); }.gm-vue-fullscreen-menu { position: fixed; z-index: 80; display: grid; min-width: 180px; max-height: 70vh; padding: 6px 0; overflow-y: auto; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-md); color: var(--gm-text); background: var(--gm-surface); box-shadow: var(--gm-shadow-md); }.gm-vue-fullscreen-menu strong { margin: 4px 6px; padding: 3px 8px; border-left: 2px solid var(--gm-primary); color: var(--gm-text-tertiary); font-size: var(--gm-text-xs); }.gm-vue-fullscreen-menu button { padding: 6px 14px; border: 0; color: var(--gm-text); background: transparent; font-size: var(--gm-text-sm); text-align: left; cursor: pointer; }.gm-vue-fullscreen-menu button:hover { background: var(--gm-surface-hover); }.gm-vue-fullscreen-menu button:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 720px) { .gm-vue-fullscreen-control__primary { align-items: stretch; flex-direction: column; }.gm-vue-fullscreen-control__group { max-width: calc(100vw - 52px); }.gm-vue-fullscreen-control button span { display: none; } }
</style>
