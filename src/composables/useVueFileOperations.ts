import { onBeforeUnmount, ref, watch } from 'vue'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { openFile, saveFile, saveFileAs } from '@/services/fileSystem'
import { scheduleMarkdownDocumentIndex } from '@/services/rag/indexer'
import { isSameFilePath } from '@/services/pathIdentity'
import { toast } from '@/services/toast'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { isTauri } from '@/hooks/useTauri'
import { useZustandSelector } from './useZustandSelector'

const AUTO_SAVE_INDEX_DELAY = 5000

export function useVueFileOperations() {
  const tabs = useZustandSelector(useEditorStore, (state) => state.tabs)
  const autoSaveEnabled = useZustandSelector(useSettingsStore, (state) => state.editor.autoSave)
  const autoSaveDelay = useZustandSelector(useSettingsStore, (state) => state.editor.autoSaveDelay)
  const timers = new Map<string, { timer: number; content: string }>()
  const retries = new Map<string, number>()
  const disposed = ref(false)

  function clearAutoSaveTimers(): void {
    for (const { timer } of timers.values()) clearTimeout(timer)
    timers.clear()
  }

  function handleNewFile(): void {
    useEditorStore.getState().addTab(undefined, '未命名.md')
  }

  async function handleOpenFile(): Promise<void> {
    try {
      const file = await openFile()
      if (!file) return
      const state = useEditorStore.getState()
      const existing = state.tabs.find((tab) => isSameFilePath(tab.filePath, file.path))
      if (existing) state.setActiveTab(existing.id)
      else state.addTab(file.path, file.name, file.content)
      scheduleMarkdownDocumentIndex(file.path, file.name, file.content)
    } catch (error) {
      console.error('Open file failed:', error)
      toast.error(describeFileOperationError(error, '打开文件失败'))
    }
  }

  async function handleSaveFile(): Promise<void> {
    const state = useEditorStore.getState()
    const tab = state.tabs.find((item) => item.id === state.activeTabId)
    if (!tab) return
    try {
      if (tab.filePath) {
        await saveFile(tab.filePath, tab.content)
        scheduleMarkdownDocumentIndex(tab.filePath, tab.title, tab.content)
        useEditorStore.getState().markTabSaved(tab.id, tab.content)
      } else {
        const result = await saveFileAs(tab.content)
        if (!result) return
        scheduleMarkdownDocumentIndex(result.path, result.name, result.content)
        useEditorStore.getState().saveTabAs(tab.id, result.path, result.name, result.content)
      }
      toast.success('已保存')
    } catch (error) {
      console.error('Save file failed:', error)
      toast.error(describeFileOperationError(error, '保存失败'))
    }
  }

  function scheduleTabSave(tabId: string, content: string, delay: number): void {
    const timer = window.setTimeout(async () => {
      timers.delete(tabId)
      const state = useEditorStore.getState()
      const tab = state.tabs.find((item) => item.id === tabId)
      if (!tab?.modified || !tab.filePath || tab.content !== content || disposed.value) return
      const retryCount = retries.get(tab.id) ?? 0
      if (retryCount >= 3) return
      try {
        await saveFile(tab.filePath, content)
        scheduleMarkdownDocumentIndex(tab.filePath, tab.title, content, AUTO_SAVE_INDEX_DELAY)
        retries.delete(tab.id)
        useEditorStore.getState().markTabSaved(tab.id, content)
      } catch (error) {
        const nextRetryCount = retryCount + 1
        retries.set(tab.id, nextRetryCount)
        console.error(`Auto-save failed for ${tab.title} (${nextRetryCount}/3):`, error)
        if (nextRetryCount >= 3) {
          toast.error(`自动保存「${tab.title}」失败: ${describeFileOperationError(error, '保存失败')}`)
        } else {
          toast.warning(`自动保存失败: ${tab.title}，${describeFileOperationError(error, '保存失败')}`)
          scheduleTabSave(tab.id, content, delay)
        }
      }
    }, delay)
    timers.set(tabId, { timer, content })
  }

  watch([tabs, autoSaveEnabled, autoSaveDelay], () => {
    if (!isTauri() || !autoSaveEnabled.value) {
      clearAutoSaveTimers()
      retries.clear()
      return
    }
    const modifiedTabIds = new Set<string>()
    for (const tab of tabs.value) {
      if (!tab.modified || !tab.filePath) continue
      modifiedTabIds.add(tab.id)
      const existing = timers.get(tab.id)
      if (existing?.content === tab.content) continue
      if (existing) clearTimeout(existing.timer)
      scheduleTabSave(tab.id, tab.content, autoSaveDelay.value || 1000)
    }
    for (const [tabId, { timer }] of timers) {
      if (modifiedTabIds.has(tabId)) continue
      clearTimeout(timer)
      timers.delete(tabId)
      retries.delete(tabId)
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    disposed.value = true
    clearAutoSaveTimers()
    retries.clear()
  })

  return { handleNewFile, handleOpenFile, handleSaveFile }
}
