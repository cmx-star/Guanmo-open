import { onBeforeUnmount, onMounted } from 'vue'
import { perfCollector } from '@/services/perfCollector'
import { eventMarker } from '@/services/eventMarker'
import { recordPerfSample, usePerfStore } from '@/stores/perfStore'
import { useEditorStore } from '@/stores/editorStore'
import { useAppStore } from '@/stores/appStore'

export function useVuePerfMonitor(): void {
  let cancelModeSettled = () => {}
  let dispose = () => {}

  onMounted(() => {
    if (!import.meta.env.DEV) return
    const timers: number[] = []
    const cancelTimers = () => { timers.splice(0).forEach((timer) => window.clearTimeout(timer)) }
    const scheduleModeSettled = (mode: string) => {
      cancelTimers()
      for (const delayMs of [2_000, 5_000]) timers.push(window.setTimeout(async () => {
        if (useEditorStore.getState().viewMode !== mode) return
        const snapshot = await perfCollector.collect()
        if (useEditorStore.getState().viewMode !== mode) return
        eventMarker.markPoint('mode-settled', snapshot, { mode, delayMs, activeDocumentCharCount: snapshot.activeDocumentCharCount, previewInstanceCount: snapshot.previewInstanceCount, editorInstanceCount: snapshot.editorInstanceCount })
      }, delayMs))
    }
    cancelModeSettled = cancelTimers
    perfCollector.setSources({ getCurrentMode: () => useEditorStore.getState().viewMode, getDocCharCount: () => { const state = useEditorStore.getState(); return state.tabs.find((tab) => tab.id === state.activeTabId)?.content.length ?? 0 } })
    perfCollector.setDocumentContextSources({
      getActiveDocumentCount: () => useEditorStore.getState().tabs.length > 0 ? 1 : 0,
      getActiveDocumentCharCount: () => { const state = useEditorStore.getState(); return state.tabs.find((tab) => tab.id === state.activeTabId)?.content.length ?? 0 },
      getTotalOpenDocumentCharCount: () => useEditorStore.getState().tabs.reduce((sum, tab) => sum + tab.content.length, 0),
      getActiveDocumentLineCount: () => { const state = useEditorStore.getState(); return state.tabs.find((tab) => tab.id === state.activeTabId)?.content.split('\n').length ?? 0 },
      getPreviewInstanceCount: () => document.querySelectorAll('.gm-markdown-preview, .gm-vue-markdown-preview').length,
      getEditorInstanceCount: () => document.querySelectorAll('.cm-editor').length,
      getAiPanelOpen: () => useAppStore.getState().aiPanelOpen,
      getIsFullscreen: () => useAppStore.getState().isFullscreen,
    })
    eventMarker.setSnapshotSource(() => usePerfStore.getState().current)
    eventMarker.setFreshSnapshotSource(() => perfCollector.collect())
    eventMarker.mark('app-start')
    const startCollector = () => perfCollector.start(usePerfStore.getState().settings.sampleIntervalMs, recordPerfSample, () => usePerfStore.getState().setSampleInterval(5_000))
    startCollector()
    const unsubscribeSettings = usePerfStore.subscribe((state, previous) => { if (state.settings.sampleIntervalMs !== previous.settings.sampleIntervalMs) startCollector() })
    const unsubscribeEvents = eventMarker.addListener(usePerfStore.getState().addEvent)
    const unsubscribeEditor = useEditorStore.subscribe((state, previous) => {
      if (state.activeTabId !== previous.activeTabId && state.activeTabId) eventMarker.mark('switch-document', { previousTabId: previous.activeTabId ? 'doc' : null, currentTabId: 'doc' })
      if (state.viewMode !== previous.viewMode) scheduleModeSettled(state.viewMode)
    })
    let modeCompleteFrame: number | null = null
    const unsubscribeModeComplete = useEditorStore.subscribe((state, previous) => {
      if (state.viewMode === previous.viewMode) return
      if (modeCompleteFrame !== null) cancelAnimationFrame(modeCompleteFrame)
      modeCompleteFrame = requestAnimationFrame(() => { modeCompleteFrame = requestAnimationFrame(() => { modeCompleteFrame = null; eventMarker.mark('switch-mode-complete', { mode: state.viewMode }) }) })
    })
    const unsubscribeApp = useAppStore.subscribe((state, previous) => { if (state.aiPanelOpen !== previous.aiPanelOpen) eventMarker.mark(state.aiPanelOpen ? 'ai-panel-open' : 'ai-panel-close'); if (state.isFullscreen !== previous.isFullscreen) eventMarker.mark(state.isFullscreen ? 'enter-fullscreen' : 'exit-fullscreen') })
    dispose = () => { perfCollector.dispose(); if (modeCompleteFrame !== null) cancelAnimationFrame(modeCompleteFrame); unsubscribeSettings(); unsubscribeEvents(); unsubscribeEditor(); unsubscribeModeComplete(); unsubscribeApp() }
  })

  onBeforeUnmount(() => { cancelModeSettled(); dispose() })
}
