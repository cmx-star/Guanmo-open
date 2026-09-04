<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import Dialog from 'primevue/dialog'
import { listen } from '@tauri-apps/api/event'
import { useI18n } from 'vue-i18n'
import { getActiveEditorView } from '@/services/editorViewRef'
import { exportMarkdownAsHtml } from '@/services/markdownExport'
import { NATIVE_MENU_COMMAND_EVENT, type NativeMenuCommand } from '@/services/nativeMenu'
import { OPEN_EDITOR_SEARCH_EVENT } from '@/services/editorEvents'
import { OPEN_SETTINGS_SECTION_EVENT } from '@/services/settingsNavigation'
import { OPEN_FEATURE_INTRO_EVENT, type FeatureIntroEventDetail } from '@/features/featureIntro/featureIntroEvents'
import { OPEN_PRODUCT_TOUR_EVENT } from '@/features/productTour/productTourEvents'
import { OVERVIEW_FEATURES, getVersionFeatures } from '@/features/featureIntro/featureIntroContent'
import { PRODUCT_TOUR_DEMO_CONTENT, PRODUCT_TOUR_DEMO_TAB_ID } from '@/features/productTour/productTourContent'
import { markStartupPoint } from '@/services/startupPerformance'
import { isTauri } from '@/hooks/useTauri'
import { toast } from '@/services/toast'
import { pickDirectory } from '@/services/fileSystem'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { useAppStore, type AiServiceStatus } from '@/stores/appStore'
import { useEditorHistoryStore } from '@/stores/editorHistoryStore'
import { useEditorStore, type ViewMode } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { useVueFileOperations } from '@/composables/useVueFileOperations'
import VueCommandPalette from '@/components/common/VueCommandPalette.vue'
import VueSidebar from './VueSidebar.vue'
import VueStatusBar from './VueStatusBar.vue'
import VueTitleBar from './VueTitleBar.vue'
import VueFullscreenFileDrawer from './VueFullscreenFileDrawer.vue'
import VueFullscreenControlBar from '@/components/editor/VueFullscreenControlBar.vue'
import VueFeatureIntroModal from '@/features/featureIntro/VueFeatureIntroModal.vue'
import VueProductTourOverlay from '@/features/productTour/VueProductTourOverlay.vue'
import VueAiPanel from '@/components/ai/VueAiPanel.vue'
import VueSettingsPage from '@/features/settings/VueSettingsPage.vue'
const VueEditorArea = defineAsyncComponent(() => import('@/components/editor/VueEditorArea.vue'))

const sidebarCollapsed = useZustandSelector(useAppStore, (state) => state.sidebarCollapsed)
const aiPanelOpen = useZustandSelector(useAppStore, (state) => state.aiPanelOpen)
const sidebarWidth = useZustandSelector(useAppStore, (state) => state.sidebarWidth)
const aiPanelWidth = useZustandSelector(useAppStore, (state) => state.aiPanelWidth)
const isFullscreen = useZustandSelector(useAppStore, (state) => state.isFullscreen)
const aiStatus = useZustandSelector(useAppStore, (state) => state.aiStatus)
const tabs = useZustandSelector(useEditorStore, (state) => state.tabs)
const activeTabId = useZustandSelector(useEditorStore, (state) => state.activeTabId)
const themeId = useZustandSelector(useSettingsStore, (state) => state.appearance.themeId)
const lastLightThemeId = useZustandSelector(useSettingsStore, (state) => state.appearance.lastLightThemeId)
const canUndo = useZustandSelector(useEditorHistoryStore, (state) => state.canUndo)
const canRedo = useZustandSelector(useEditorHistoryStore, (state) => state.canRedo)
const { handleNewFile, handleOpenFile, handleSaveFile } = useVueFileOperations()

const commandPaletteOpen = ref(false)
const commandPaletteMode = ref<'commands' | 'files'>('commands')
const settingsOpen = ref(false)
const settingsSection = ref<string | null>(null)
const featureIntroOpen = ref(false)
const featureIntroMode = ref<'overview' | 'version'>('overview')
const featureIntroVersion = ref<string | undefined>()
const fullscreenFileDrawerOpen = ref(false)
const productTourOpen = ref(false)
const productTourStep = ref(0)
const fullscreenAiPosition = ref({ x: 16, y: 64 })
const fullscreenAiPanel = ref<HTMLDivElement | null>(null)
const { t } = useI18n()
const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value))
const wordCount = computed(() => {
  const content = activeTab.value?.content.trim()
  if (!content) return 0
  const chineseCharacters = content.match(/[一-鿿]/g)?.length ?? 0
  return chineseCharacters + content.replace(/[一-鿿]/g, ' ').split(/\s+/).filter(Boolean).length
})

const statusLabels: Record<AiServiceStatus, string> = {
  ok: 'desktop.aiStatus.ready', chat_unreachable: 'desktop.aiStatus.chatUnreachable', embedding_unreachable: 'desktop.aiStatus.embeddingUnreachable', both_unreachable: 'desktop.aiStatus.bothUnreachable', search_unreachable: 'desktop.aiStatus.searchUnreachable', chat_search_unreachable: 'desktop.aiStatus.chatSearchUnreachable', embedding_search_unreachable: 'desktop.aiStatus.embeddingSearchUnreachable', all_unreachable: 'desktop.aiStatus.allUnreachable', not_configured: 'desktop.aiStatus.notConfigured', unchecked: 'desktop.aiStatus.checking',
}

let sidebarResizing = false
let aiResizing = false
let unlistenNativeMenu: (() => void) | undefined
let unlistenWindowResize: (() => void) | undefined
let shouldRestoreMaximizedAfterFullscreen = false
let fullscreenAiDrag: { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null = null
let productTourSnapshot: {
  activeTabId: string | null
  viewMode: ViewMode
  previewVisible: boolean
  rightPaneTabId: string | null
  rightPaneUserSelected: boolean
  createdDemoTab: boolean
} | null = null

function runHistoryAction(action: 'undo' | 'redo'): void {
  const view = getActiveEditorView()
  if (!view) return
  void import('@codemirror/commands').then(({ undo, redo }) => (action === 'undo' ? undo : redo)({ state: view.state, dispatch: view.dispatch }))
}

async function readFullscreenState(): Promise<boolean> {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    return getCurrentWindow().isFullscreen()
  }
  return Boolean(document.fullscreenElement)
}

async function toggleFullscreen(): Promise<void> {
  try {
    const next = !await readFullscreenState()
    if (isTauri()) {
      const { currentMonitor, getCurrentWindow } = await import('@tauri-apps/api/window')
      const currentWindow = getCurrentWindow()
      if (next) {
        const wasMaximized = await currentWindow.isMaximized()
        shouldRestoreMaximizedAfterFullscreen = wasMaximized
        if (wasMaximized) {
          await currentWindow.unmaximize()
          await new Promise<void>((resolve) => window.setTimeout(resolve, 50))
          const monitor = await currentMonitor()
          if (monitor) {
            await currentWindow.setPosition(monitor.position)
            await currentWindow.setSize(monitor.size)
          }
          await new Promise<void>((resolve) => window.setTimeout(resolve, 50))
        }
        await currentWindow.setFullscreen(true)
      } else {
        await currentWindow.setFullscreen(false)
        if (shouldRestoreMaximizedAfterFullscreen) {
          shouldRestoreMaximizedAfterFullscreen = false
          await new Promise<void>((resolve) => window.setTimeout(resolve, 50))
          await currentWindow.maximize()
        }
      }
    } else if (next) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
    useAppStore.getState().setFullscreen(next)
  } catch (error) {
    console.error('Fullscreen toggle failed:', error)
  }
}

async function exitFullscreen(): Promise<void> {
  if (!isFullscreen.value) return
  await toggleFullscreen()
}

function toggleTheme(): void {
  useSettingsStore.getState().updateAppearanceSettings({ themeId: themeId.value === 'dark' ? lastLightThemeId.value : 'dark' })
}

async function openWorkspaceFolder(): Promise<void> {
  if (!isTauri()) { toast.error(t('common.unavailableInBrowser')); return }
  try {
    const path = await pickDirectory()
    if (!path) return
    if (!useAppStore.getState().addWorkspaceRoot(path)) toast.error(t('sidebar.workspaceAlreadyOpen'))
  } catch (error) { console.error('Open folder failed:', error); toast.error(describeFileOperationError(error, t('sidebar.openFolder'))) }
}

function openSearch(): void {
  window.dispatchEvent(new Event(OPEN_EDITOR_SEARCH_EVENT))
}

function openCommandPalette(mode: 'commands' | 'files'): void {
  commandPaletteMode.value = mode
  commandPaletteOpen.value = true
}

async function runAfterNormalLayout(action: () => void | Promise<void>): Promise<void> {
  if (isFullscreen.value) await exitFullscreen()
  await action()
}

async function exportHtml(): Promise<void> {
  const tab = activeTab.value
  if (!tab) return
  try {
    await exportMarkdownAsHtml(tab.content, tab.title.replace(/\.(md|markdown|mdx)$/i, ''), tab.filePath)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'HTML export failed')
  }
}

function openSettings(section: string | null = null): void {
  void runAfterNormalLayout(() => {
    settingsSection.value = section
    settingsOpen.value = true
  })
}

function toggleFullscreenFileDrawer(): void {
  fullscreenFileDrawerOpen.value = !fullscreenFileDrawerOpen.value
}

function getFullscreenAiSize(): { width: number; height: number } {
  return { width: Math.min(404, Math.max(320, window.innerWidth - 32)), height: Math.min(680, Math.max(360, window.innerHeight - 32)) }
}

function clampFullscreenAiPosition(x: number, y: number): { x: number; y: number } {
  const size = getFullscreenAiSize()
  return { x: Math.min(Math.max(16, x), Math.max(16, window.innerWidth - size.width - 16)), y: Math.min(Math.max(16, y), Math.max(16, window.innerHeight - size.height - 16)) }
}

function resetFullscreenAiPosition(): void {
  const size = getFullscreenAiSize()
  fullscreenAiPosition.value = clampFullscreenAiPosition(window.innerWidth - size.width - 16, 64)
}

function handleFullscreenAiDragStart(event: PointerEvent): void {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  fullscreenAiDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: fullscreenAiPosition.value.x, originY: fullscreenAiPosition.value.y }
  document.body.style.userSelect = 'none'
}

function handleFullscreenAiDragMove(event: PointerEvent): void {
  if (!fullscreenAiDrag || fullscreenAiDrag.pointerId !== event.pointerId) return
  fullscreenAiPosition.value = clampFullscreenAiPosition(fullscreenAiDrag.originX + event.clientX - fullscreenAiDrag.startX, fullscreenAiDrag.originY + event.clientY - fullscreenAiDrag.startY)
}

function handleFullscreenAiDragEnd(event: PointerEvent): void {
  if (!fullscreenAiDrag || fullscreenAiDrag.pointerId !== event.pointerId) return
  fullscreenAiDrag = null
  document.body.style.userSelect = ''
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
}

function startProductTour(): void {
  if (productTourOpen.value) return
  const editor = useEditorStore.getState()
  const createdDemoTab = editor.tabs.length === 0
  productTourSnapshot = { activeTabId: editor.activeTabId, viewMode: editor.viewMode, previewVisible: editor.previewVisible, rightPaneTabId: editor.rightPaneTabId, rightPaneUserSelected: editor.rightPaneUserSelected, createdDemoTab }
  if (createdDemoTab) editor.openTab({ id: PRODUCT_TOUR_DEMO_TAB_ID, title: '观墨产品导览.md', filePath: null, content: PRODUCT_TOUR_DEMO_CONTENT, savedContent: PRODUCT_TOUR_DEMO_CONTENT, originalContent: PRODUCT_TOUR_DEMO_CONTENT, modified: false, ephemeral: true })
  editor.setViewMode('preview')
  useAppStore.getState().closeAiPanel()
  if (!useAppStore.getState().sidebarCollapsed) useAppStore.getState().toggleSidebar()
  settingsOpen.value = false
  productTourStep.value = 0
  productTourOpen.value = true
}

function finishProductTour(): void {
  const snapshot = productTourSnapshot
  if (snapshot) {
    const editor = useEditorStore.getState()
    if (snapshot.createdDemoTab && editor.tabs.some((tab) => tab.id === PRODUCT_TOUR_DEMO_TAB_ID)) editor.closeTab(PRODUCT_TOUR_DEMO_TAB_ID)
    useEditorStore.setState({ viewMode: snapshot.viewMode, previewVisible: snapshot.previewVisible, rightPaneTabId: snapshot.rightPaneTabId, rightPaneUserSelected: snapshot.rightPaneUserSelected, activeTabId: snapshot.activeTabId && useEditorStore.getState().tabs.some((tab) => tab.id === snapshot.activeTabId) ? snapshot.activeTabId : null, previewSwitchingTabId: null })
  }
  productTourSnapshot = null
  productTourOpen.value = false
  productTourStep.value = 0
}

function sidebarResizeStart(event: MouseEvent): void { event.preventDefault(); sidebarResizing = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none' }
function aiResizeStart(event: MouseEvent): void { event.preventDefault(); aiResizing = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none' }
function handlePointerMove(event: MouseEvent): void {
  if (sidebarResizing) useAppStore.getState().setSidebarWidth(Math.max(250, Math.min(500, event.clientX)))
  if (aiResizing) useAppStore.getState().setAiPanelWidth(Math.max(280, Math.min(600, window.innerWidth - event.clientX)))
}
function handlePointerUp(): void { if (!sidebarResizing && !aiResizing) return; sidebarResizing = false; aiResizing = false; document.body.style.cursor = ''; document.body.style.userSelect = '' }

function shortcutKey(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('CTRL')
  if (event.shiftKey) parts.push('SHIFT')
  if (event.altKey) parts.push('ALT')
  parts.push(event.code.startsWith('Key') ? event.code.slice(3).toUpperCase() : event.code.startsWith('Digit') ? event.code.slice(5) : event.key.toUpperCase())
  return parts.join('+')
}

function handleKeyboardShortcut(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    const key = event.key.toLowerCase()
    if (key === 'i') {
      event.preventDefault()
      event.stopPropagation()
      openSettings()
      return
    }
    if (['s', 'f', 'g', 'h', 'p', 'b', 'j', 'e', 'd', '1', '2', '3', '4', '5'].includes(key)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  const action = {
    'CTRL+P': () => openCommandPalette('files'), 'CTRL+SHIFT+P': () => openCommandPalette('commands'), 'CTRL+B': () => isFullscreen.value ? toggleFullscreenFileDrawer() : useAppStore.getState().toggleSidebar(), 'CTRL+J': () => useAppStore.getState().toggleAiPanel(), 'CTRL+N': handleNewFile, 'CTRL+O': () => void runAfterNormalLayout(handleOpenFile), 'CTRL+S': handleSaveFile, 'CTRL+SHIFT+V': () => useEditorStore.getState().togglePreview(), 'CTRL+SHIFT+D': () => useEditorStore.getState().toggleDiffPreview(), 'CTRL+SHIFT+L': toggleTheme, 'F11': () => void toggleFullscreen(), 'CTRL+SHIFT+1': () => useEditorStore.getState().setViewMode('edit'), 'CTRL+SHIFT+2': () => useEditorStore.getState().setViewMode('preview'), 'CTRL+SHIFT+3': () => useEditorStore.getState().setViewMode('edit-preview'), 'CTRL+SHIFT+4': () => useEditorStore.getState().setViewMode('dual-preview'), 'CTRL+SHIFT+5': () => useEditorStore.getState().setViewMode('diff-preview'), 'CTRL+SHIFT+E': () => void exportHtml(), 'CTRL+I': () => openSettings(),
  } as Record<string, () => void>
  const handler = action[shortcutKey(event)]
  if (!handler) return
  event.preventDefault()
  event.stopPropagation()
  handler()
}

function handleSettingsSectionEvent(event: Event): void {
  openSettings((event as CustomEvent<{ section?: string }>).detail?.section ?? null)
}

function handleFeatureIntroEvent(event: Event): void {
  const detail = (event as CustomEvent<FeatureIntroEventDetail>).detail
  featureIntroMode.value = detail.mode
  featureIntroVersion.value = detail.version
  featureIntroOpen.value = true
}

function syncBrowserFullscreenState(): void {
  useAppStore.getState().setFullscreen(Boolean(document.fullscreenElement))
}

function handleNativeMenu(command: NativeMenuCommand): void {
  switch (command) {
    case 'app.settings': openSettings(); break
    case 'file.new': handleNewFile(); break
    case 'file.open': void runAfterNormalLayout(handleOpenFile); break
    case 'file.save': void handleSaveFile(); break
    case 'file.close-tab': if (activeTabId.value) useEditorStore.getState().closeTab(activeTabId.value); break
    case 'file.export-html': void runAfterNormalLayout(exportHtml); break
    case 'edit.undo': runHistoryAction('undo'); break
    case 'edit.redo': runHistoryAction('redo'); break
    case 'edit.find': void runAfterNormalLayout(openSearch); break
    case 'view.command-palette': openCommandPalette('commands'); break
    case 'view.toggle-sidebar': useAppStore.getState().toggleSidebar(); break
    case 'view.toggle-ai': useAppStore.getState().toggleAiPanel(); break
    case 'view.toggle-preview': useEditorStore.getState().togglePreview(); break
    case 'view.toggle-fullscreen': void toggleFullscreen(); break
    case 'help.product-tour': startProductTour(); break
    case 'help.feature-intro': featureIntroMode.value = 'overview'; featureIntroOpen.value = true; break
  }
}

const fullscreenAiProps = computed(() => ({ fullscreenDragHandleProps: { onPointerDown: handleFullscreenAiDragStart, onPointerMove: handleFullscreenAiDragMove, onPointerUp: handleFullscreenAiDragEnd, onPointerCancel: handleFullscreenAiDragEnd } }))
const featureIntroFeatures = computed(() => featureIntroMode.value === 'overview' ? OVERVIEW_FEATURES : featureIntroVersion.value ? (getVersionFeatures(featureIntroVersion.value) ?? []) : [])

onMounted(() => {
  markStartupPoint('app-shell-first-visible')
  requestAnimationFrame(() => {
    markStartupPoint('first-animation-frame')
  })
  markStartupPoint('app-shell-interactive')
  window.addEventListener('mousemove', handlePointerMove)
  window.addEventListener('mouseup', handlePointerUp)
  window.addEventListener('keydown', handleKeyboardShortcut, true)
  window.addEventListener(OPEN_SETTINGS_SECTION_EVENT, handleSettingsSectionEvent)
  window.addEventListener(OPEN_FEATURE_INTRO_EVENT, handleFeatureIntroEvent)
  window.addEventListener(OPEN_PRODUCT_TOUR_EVENT, startProductTour)
  if (isTauri()) {
    void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      const currentWindow = getCurrentWindow()
      void currentWindow.onResized(() => {
        void currentWindow.isFullscreen().then((value) => {
          useAppStore.getState().setFullscreen(value)
          if (!value && shouldRestoreMaximizedAfterFullscreen) {
            shouldRestoreMaximizedAfterFullscreen = false
            void window.setTimeout(() => currentWindow.maximize(), 50)
          }
        })
        fullscreenAiPosition.value = clampFullscreenAiPosition(fullscreenAiPosition.value.x, fullscreenAiPosition.value.y)
      }).then((unlisten) => { unlistenWindowResize = unlisten })
    })
    void listen<NativeMenuCommand>(NATIVE_MENU_COMMAND_EVENT, ({ payload }) => handleNativeMenu(payload)).then((unlisten) => { unlistenNativeMenu = unlisten })
  } else {
    document.addEventListener('fullscreenchange', syncBrowserFullscreenState)
  }
  resetFullscreenAiPosition()
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handlePointerMove)
  window.removeEventListener('mouseup', handlePointerUp)
  window.removeEventListener('keydown', handleKeyboardShortcut, true)
  window.removeEventListener(OPEN_SETTINGS_SECTION_EVENT, handleSettingsSectionEvent)
  window.removeEventListener(OPEN_FEATURE_INTRO_EVENT, handleFeatureIntroEvent)
  window.removeEventListener(OPEN_PRODUCT_TOUR_EVENT, startProductTour)
  document.removeEventListener('fullscreenchange', syncBrowserFullscreenState)
  unlistenNativeMenu?.()
  unlistenWindowResize?.()
})
</script>

<template>
  <div class="gm-vue-app-layout">
    <VueTitleBar
      v-if="!isFullscreen"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :is-fullscreen="isFullscreen"
      :is-tauri="isTauri()"
      :is-dark="themeId === 'dark'"
      :sidebar-collapsed="sidebarCollapsed"
      :on-toggle-sidebar="() => useAppStore.getState().toggleSidebar()"
      :on-new-file="handleNewFile"
      :on-open-file="() => void runAfterNormalLayout(handleOpenFile)"
      :on-open-folder="() => void openWorkspaceFolder()"
      :on-open-search="openSearch"
      :on-open-settings="openSettings"
      :on-undo="() => runHistoryAction('undo')"
      :on-redo="() => runHistoryAction('redo')"
      :on-toggle-theme="toggleTheme"
      :on-toggle-fullscreen="toggleFullscreen"
    />
    <div class="gm-vue-app-layout__main">
      <VueSidebar v-if="!isFullscreen && !sidebarCollapsed" :width="sidebarWidth" :on-resize-start="sidebarResizeStart" />
      <main class="gm-vue-app-layout__editor"><VueEditorArea /></main>
      <aside v-if="!isFullscreen && aiPanelOpen" class="gm-vue-app-layout__ai" :style="{ width: `${aiPanelWidth}px` }">
        <div class="gm-vue-app-layout__resize" @mousedown="aiResizeStart"></div>
        <VueAiPanel />
      </aside>
    </div>
    <VueFullscreenControlBar v-if="isFullscreen" :file-drawer-open="fullscreenFileDrawerOpen" :on-toggle-file-drawer="toggleFullscreenFileDrawer" :on-close-file-drawer="() => { fullscreenFileDrawerOpen = false }" :on-exit-fullscreen="exitFullscreen" />
    <VueFullscreenFileDrawer v-if="isFullscreen" :open="fullscreenFileDrawerOpen" :on-close="() => fullscreenFileDrawerOpen = false" :on-open-search="openSearch" />
    <div v-if="isFullscreen && aiPanelOpen" ref="fullscreenAiPanel" class="gm-vue-app-layout__fullscreen-ai" :style="{ left: `${fullscreenAiPosition.x}px`, top: `${fullscreenAiPosition.y}px`, width: `${getFullscreenAiSize().width}px`, height: `${getFullscreenAiSize().height}px` }"><VueAiPanel v-bind="fullscreenAiProps" /></div>
    <VueStatusBar v-if="!isFullscreen" :file-path="activeTab?.filePath ?? null" :file-title="activeTab?.title ?? null" :modified="Boolean(activeTab?.modified)" :word-count="wordCount" :ai-status="aiStatus" :ai-status-label="statusLabels[aiStatus]" :on-toggle-assistant="() => useAppStore.getState().toggleAiPanel()" />
    <VueCommandPalette :open="commandPaletteOpen" :mode="commandPaletteMode" :on-close="() => commandPaletteOpen = false" />
    <Dialog v-model:visible="settingsOpen" modal :dismissable-mask="true" :draggable="false" :header="t('settings.title')" :style="{ width: '860px', maxWidth: 'calc(100vw - 32px)' }" :content-style="{ height: '560px', padding: '6px 14px 10px', overflow: 'hidden' }" @hide="settingsSection = null"><VueSettingsPage :initial-section="settingsSection" /></Dialog>
    <VueFeatureIntroModal :open="featureIntroOpen" :features="featureIntroFeatures" @close="featureIntroOpen = false" />
    <VueProductTourOverlay :open="productTourOpen" :step-index="productTourStep" @step-change="productTourStep = $event" @close="finishProductTour" />
  </div>
</template>

<style scoped>
.gm-vue-app-layout { display: flex; width: 100%; height: 100%; flex-direction: column; overflow: hidden; background: var(--gm-canvas); }
.gm-vue-app-layout__main { display: flex; min-height: 0; flex: 1; overflow: hidden; }
.gm-vue-app-layout__editor { display: flex; min-width: 0; min-height: 0; flex: 1; overflow: hidden; }
.gm-vue-app-layout__editor > :deep(.contents) { display: contents; }
.gm-vue-app-layout__boot { width: 100%; margin: 0; padding: 24px 32px; overflow: auto; color: var(--gm-text); font: inherit; white-space: pre-wrap; word-break: break-word; }
.gm-vue-app-layout__ai { position: relative; min-width: 280px; border-left: 1px solid var(--gm-border); }
.gm-vue-app-layout__ai > :deep(.contents) { display: contents; }
.gm-vue-app-layout__resize { position: absolute; z-index: 10; top: 0; bottom: 0; left: 0; width: 4px; cursor: col-resize; }
.gm-vue-app-layout__resize:hover { background: color-mix(in srgb, var(--gm-primary) 30%, transparent); }
.gm-vue-app-layout__fullscreen-ai { position: fixed; z-index: 45; overflow: hidden; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); background: color-mix(in srgb, var(--gm-surface) 92%, transparent); box-shadow: var(--gm-shadow-md); backdrop-filter: blur(12px); }
.gm-vue-app-layout__fullscreen-ai > :deep(.contents) { display: contents; }
</style>

<style>
::highlight(search-highlight) { background-color: color-mix(in srgb, var(--gm-warning) 35%, transparent); }
::highlight(search-highlight-active) { background-color: color-mix(in srgb, var(--gm-warning) 70%, transparent); }
::highlight(preview-context-selection) { background-color: color-mix(in srgb, var(--gm-primary) 28%, transparent); }
</style>
