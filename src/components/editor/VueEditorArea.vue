<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { EditorView } from '@codemirror/view'
import { ImagePlus } from 'lucide-vue-next'
import { useAppStore } from '@/stores/appStore'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { useVueFileOperations } from '@/composables/useVueFileOperations'
import { extractToc } from '@/services/markdownToc'
import type { PreviewBlock } from '@/services/markdownPreviewModel'
import { toggleMarkdownTaskAtLine } from '@/services/markdownTasks'
import { saveImageFileForMarkdown } from '@/services/markdownImages'
import { toast } from '@/services/toast'
import { OPEN_EDITOR_SEARCH_EVENT } from '@/services/editorEvents'
import VueTabBar from './VueTabBar.vue'
import VueCodeMirrorEditor from './VueCodeMirrorEditor.vue'
import VueMarkdownPreview from './VueMarkdownPreview.vue'
import VueMarkdownDiffView from './VueMarkdownDiffView.vue'
import VueMarkdownToc from './VueMarkdownToc.vue'
import VueSearchOverlay from './VueSearchOverlay.vue'

const { t } = useI18n()
const tabs = useZustandSelector(useEditorStore, (state) => state.tabs)
const activeTabId = useZustandSelector(useEditorStore, (state) => state.activeTabId)
const viewMode = useZustandSelector(useEditorStore, (state) => state.viewMode)
const rightPaneTabId = useZustandSelector(useEditorStore, (state) => state.rightPaneTabId)
const rightPaneUserSelected = useZustandSelector(useEditorStore, (state) => state.rightPaneUserSelected)
const isFullscreen = useZustandSelector(useAppStore, (state) => state.isFullscreen)
const editorSettings = useZustandSelector(useSettingsStore, (state) => state.editor)
const { handleSaveFile } = useVueFileOperations()
const editorView = ref<EditorView | null>(null)
const editorViewRef = { current: null as EditorView | null }
const searchOpen = ref(false)
const tocCollapsed = ref(false)
const rightPaneDragOver = ref(false)
const imageInput = ref<HTMLInputElement | null>(null)
const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value) ?? null)
const selectedRightTab = computed(() => rightPaneTabId.value ? tabs.value.find((tab) => tab.id === rightPaneTabId.value) ?? null : null)
const rightTab = computed(() => rightPaneUserSelected.value ? selectedRightTab.value : activeTab.value)
const toc = computed(() => extractToc(activeTab.value?.content ?? ''))
const rightToc = computed(() => extractToc(rightTab.value?.content ?? ''))
const editorVisible = computed(() => viewMode.value === 'edit' || viewMode.value === 'edit-preview')
const previewVisible = computed(() => viewMode.value === 'preview' || viewMode.value === 'edit-preview' || viewMode.value === 'dual-preview')
const fullStyle = computed(() => isFullscreen.value ? { '--gm-fullscreen-content-padding': `${editorSettings.value.fullscreenContentPadding}px` } : undefined)

function onViewChange(view: EditorView | null): void { editorView.value = view; editorViewRef.current = view }
function updateContent(content: string): void { if (activeTab.value) useEditorStore.getState().updateTabContent(activeTab.value.id, content) }
function jumpToEditor(line: number): void { const view = editorView.value; if (!view) return; const target = Math.max(1, Math.min(line, view.state.doc.lines)); const from = view.state.doc.line(target).from; view.dispatch({ selection: { anchor: from }, effects: EditorView.scrollIntoView(from, { y: 'start' }) }); view.focus() }
function jumpToPreview(line: number, pane: 'left' | 'right' = 'left'): void { const root = document.querySelector<HTMLElement>(`[data-vue-preview-pane='${pane}'] [data-md-line='${line}']`); root?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }
function taskToggle(tabId: string, line: number, checked: boolean): void { const tab = tabs.value.find((item) => item.id === tabId); if (!tab) return; const next = toggleMarkdownTaskAtLine(tab.content, line, checked); if (next !== null) useEditorStore.getState().updateTabContent(tab.id, next) }
async function commitPreviewBlock(request: { block: PreviewBlock; draft: string; documentKey: string; documentVersion: number | string }): Promise<{ status: 'applied'; content?: string } | { status: 'conflict'; currentSource: string }> { const tab = useEditorStore.getState().tabs.find((item) => item.id === request.documentKey); if (!tab) return { status: 'conflict', currentSource: '' }; const { replaceMarkdownBlock } = await import('@/services/markdownBlocks'); const result = await replaceMarkdownBlock(tab.content, request.block, request.draft); if (result.status === 'conflict') { toast.warning(t('editorArea.blockConflict')); return result }; if (result.content !== tab.content) useEditorStore.getState().updateTabContent(tab.id, result.content); return { status: 'applied', content: result.content } }
function onSearchOpen(): void { searchOpen.value = true }
function onRightPaneDrop(event: DragEvent): void { event.preventDefault(); rightPaneDragOver.value = false; const raw = event.dataTransfer?.getData('application/x-guanmo-tab'); try { const id = raw ? (JSON.parse(raw) as { tabId?: string }).tabId : undefined; if (id) { useEditorStore.getState().setRightPaneTabId(id); useEditorStore.getState().setViewMode('dual-preview') } } catch {} }
async function insertImages(files: File[], insertAt?: number): Promise<void> { const tab = activeTab.value; const view = editorView.value; if (!tab || !view || !files.length) return; if (!tab.filePath) { toast.warning(t('editorArea.saveBeforeImage')); return } try { const urls = await Promise.all(files.map((file) => saveImageFileForMarkdown(tab.filePath!, file))); const at = insertAt ?? view.state.selection.main.head; const markdown = urls.map((url) => `![${url.split('/').pop()?.replace(/\.[^.]+$/, '') || 'image'}](${url})`).join('\n'); view.dispatch({ changes: { from: at, to: at, insert: markdown }, selection: { anchor: at + markdown.length } }); view.focus() } catch (error) { toast.error(error instanceof Error ? error.message : t('editorArea.insertImageFailed')) } }
function onImageInput(event: Event): void { const files = Array.from((event.target as HTMLInputElement).files ?? []); void insertImages(files); (event.target as HTMLInputElement).value = '' }

watch(isFullscreen, (fullscreen) => { if (fullscreen) tocCollapsed.value = true })
onMounted(() => window.addEventListener(OPEN_EDITOR_SEARCH_EVENT, onSearchOpen))
onBeforeUnmount(() => window.removeEventListener(OPEN_EDITOR_SEARCH_EVENT, onSearchOpen))
</script>

<template>
  <section class="gm-vue-editor-area" :style="fullStyle">
    <VueTabBar v-if="!isFullscreen" />
    <main class="gm-vue-editor-area__main">
      <div v-if="!tabs.length" class="gm-vue-editor-area__empty"><h2>{{ t('editorArea.emptyTitle') }}</h2><p>{{ t('editorArea.emptyHint') }}</p></div>
      <template v-else>
        <VueMarkdownDiffView v-if="viewMode === 'diff-preview' && activeTab" :original="activeTab.originalContent" :current="activeTab.content" :font-size="editorSettings.fontSize" :line-height="editorSettings.lineHeight" :font-family="editorSettings.fontFamily" :word-wrap="editorSettings.wordWrap" :line-numbers="editorSettings.lineNumbers" :document-key="activeTab.id" />
        <div v-else class="gm-vue-editor-area__surface">
          <section v-if="editorVisible && activeTab" class="gm-vue-editor-area__editor" :class="{ 'gm-vue-editor-area__editor--split': viewMode === 'edit-preview' }"><VueCodeMirrorEditor :content="activeTab.content" :on-change="updateContent" :on-save="handleSaveFile" :on-image-files="insertImages" :on-view-change="onViewChange" :document-key="activeTab.id" :tab-id="activeTab.id" /><input ref="imageInput" type="file" accept="image/*" multiple hidden @change="onImageInput" /><button type="button" class="gm-vue-editor-area__image" :title="t('editorArea.chooseImage')" :aria-label="t('editorArea.chooseImage')" @click="imageInput?.click()"><ImagePlus :size="16" aria-hidden="true" /></button></section>
          <section v-if="previewVisible && activeTab" data-vue-preview-pane="left" class="gm-vue-editor-area__preview" :class="{ 'gm-vue-editor-area__preview--split': viewMode === 'dual-preview' }"><header v-if="viewMode === 'dual-preview'">{{ activeTab.title }}</header><VueMarkdownPreview :content="activeTab.content" :document-key="activeTab.id" :document-version="activeTab.content" :inline-edit-enabled="editorSettings.inlinePreviewEdit" :on-block-commit="commitPreviewBlock" :font-size="editorSettings.fontSize" :line-height="editorSettings.lineHeight" :font-family="editorSettings.fontFamily" :word-wrap="editorSettings.wordWrap" :on-heading-click="(line) => viewMode === 'edit-preview' ? jumpToEditor(line) : undefined" :on-task-toggle="(line, checked) => taskToggle(activeTab!.id, line, checked)" /></section>
          <section v-if="viewMode === 'dual-preview'" data-vue-preview-pane="right" class="gm-vue-editor-area__preview gm-vue-editor-area__preview--right" :class="{ 'gm-vue-editor-area__preview--drop': rightPaneDragOver }" @dragover.prevent="rightPaneDragOver = true" @dragleave="rightPaneDragOver = false" @drop="onRightPaneDrop"><header>{{ rightTab?.title ?? t('editorArea.selectFile') }}<button v-if="rightTab" type="button" :title="t('editorArea.closeRightPane')" @click="useEditorStore.getState().setRightPaneTabId(null); useEditorStore.getState().setViewMode('edit')">{{ t('editorArea.closeRightPane') }}</button></header><VueMarkdownPreview v-if="rightTab" :content="rightTab.content" :document-key="rightTab.id" :document-version="rightTab.content" :inline-edit-enabled="editorSettings.inlinePreviewEdit" :on-block-commit="commitPreviewBlock" :font-size="editorSettings.fontSize" :line-height="editorSettings.lineHeight" :font-family="editorSettings.fontFamily" :word-wrap="editorSettings.wordWrap" :on-task-toggle="(line, checked) => taskToggle(rightTab!.id, line, checked)" /><p v-else class="gm-vue-editor-area__right-empty">{{ t('editorArea.rightEmpty') }}</p></section>
          <VueMarkdownToc v-if="viewMode === 'dual-preview'" :collapsed="tocCollapsed" :on-toggle="() => tocCollapsed = !tocCollapsed" :sections="[{ key: 'left', title: activeTab?.title ?? '', toc, onHeadingClick: (item) => jumpToPreview(item.line, 'left') }, { key: 'right', title: rightTab?.title ?? '', toc: rightToc, onHeadingClick: (item) => jumpToPreview(item.line, 'right') }]" />
          <VueMarkdownToc v-else :toc="toc" :collapsed="tocCollapsed" :on-toggle="() => tocCollapsed = !tocCollapsed" :on-heading-click="(item) => previewVisible ? jumpToPreview(item.line) : jumpToEditor(item.line)" />
        </div>
      </template>
      <VueSearchOverlay v-if="searchOpen && tabs.length" :on-close="() => searchOpen = false" :editor-view-ref="editorViewRef" />
    </main>
  </section>
</template>

<style scoped>
.gm-vue-editor-area { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; background: var(--gm-canvas); }.gm-vue-editor-area__main { position: relative; display: flex; min-height: 0; flex: 1; overflow: hidden; }.gm-vue-editor-area__empty { display: grid; flex: 1; place-content: center; color: var(--gm-text-secondary); text-align: center; }.gm-vue-editor-area__empty h2 { margin: 0; color: var(--gm-text); font-size: var(--gm-text-lg); }.gm-vue-editor-area__empty p { margin: 8px 0 0; font-size: var(--gm-text-sm); }.gm-vue-editor-area__surface { display: flex; min-width: 0; min-height: 0; flex: 1; overflow: hidden; background: var(--gm-surface); }.gm-vue-editor-area__editor { position: relative; min-width: 0; flex: 1; overflow: hidden; }.gm-vue-editor-area__editor--split { border-right: 1px solid var(--gm-border-subtle); }.gm-vue-editor-area__image { position: absolute; z-index: 2; top: 10px; right: 10px; display: grid; width: 32px; height: 32px; place-items: center; color: var(--gm-text-secondary); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-sm); background: color-mix(in srgb, var(--gm-surface) 92%, transparent); }.gm-vue-editor-area__image:hover { color: var(--gm-primary); border-color: var(--gm-primary); }.gm-vue-editor-area__preview { min-width: 0; flex: 1; padding: 24px; overflow: auto; background: var(--gm-surface); }.gm-vue-editor-area__preview--split { border-right: 1px solid var(--gm-border-subtle); }.gm-vue-editor-area__preview--right { border-left: 0; }.gm-vue-editor-area__preview--drop { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--gm-primary) 50%, transparent); }.gm-vue-editor-area__preview header { display: flex; min-height: 28px; margin: -6px 0 14px; align-items: center; justify-content: space-between; color: var(--gm-text-secondary); border-bottom: 1px solid var(--gm-border-subtle); font-size: var(--gm-text-sm); font-weight: 700; }.gm-vue-editor-area__preview header button { padding: 4px 7px; color: var(--gm-text-secondary); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-sm); background: transparent; font-size: var(--gm-text-xs); }.gm-vue-editor-area__right-empty { display: grid; height: 100%; margin: 0; place-items: center; color: var(--gm-text-tertiary); font-size: var(--gm-text-sm); text-align: center; }
</style>
