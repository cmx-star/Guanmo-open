import { onBeforeUnmount, watch, type Ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { authorizeDroppedPaths, isTauri } from '@/hooks/useTauri'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { isImagePath, isMarkdownPath, openExternalFilePaths, type ExternalFileOpenSource } from '@/services/externalFileOpen'
import { toast } from '@/services/toast'

const OPEN_FILES_EVENT = 'guanmo:open-files'
const DROP_IMAGES_EVENT = 'guanmo:drop-image-paths'

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path
}

async function focusMainWindow(): Promise<void> {
  try {
    const currentWindow = getCurrentWindow()
    await currentWindow.show()
    await currentWindow.unminimize()
    await currentWindow.setFocus()
  } catch (error) {
    console.warn('[ExternalFileOpen] Failed to focus window:', error)
  }
}

export function useVueExternalFileOpen(appReady: Ref<boolean>): void {
  let cleanup: (() => void) | undefined
  let draining = false
  let drainRequested = false

  const stop = watch(appReady, (ready) => {
    cleanup?.()
    cleanup = undefined
    if (!ready || !isTauri()) return

    let disposed = false
    let unlistenOpenFiles: (() => void) | undefined
    let unlistenDragDrop: (() => void) | undefined

    const openPaths = async (paths: string[], source: ExternalFileOpenSource): Promise<void> => {
      const imagePaths = source === 'drag-drop' ? paths.filter(isImagePath) : []
      const openablePaths = source === 'drag-drop' ? paths.filter((path) => !isImagePath(path)) : paths
      if (imagePaths.length > 0) window.dispatchEvent(new CustomEvent(DROP_IMAGES_EVENT, { detail: { paths: imagePaths } }))

      const result = await openExternalFilePaths(openablePaths, source)
      if (result.ignored.some((path) => !isMarkdownPath(path))) toast.warning('仅支持拖入 .md 文件')
      for (const failure of result.failed) toast.error(`打开「${getFileName(failure.path)}」失败: ${failure.reason}`)
      if (source === 'file-association' && result.opened.length > 0) await focusMainWindow()
    }

    const drainPendingFiles = async (): Promise<void> => {
      drainRequested = true
      if (draining) return
      draining = true
      try {
        while (drainRequested && !disposed) {
          drainRequested = false
          const paths = await invoke<string[]>('take_pending_open_files')
          if (paths.length > 0) await openPaths(paths, 'file-association')
        }
      } catch (error) {
        console.error('[ExternalFileOpen] Failed to load pending files:', error)
      } finally {
        draining = false
      }
    }

    const handleDroppedPaths = async (paths: string[]): Promise<void> => {
      const supportedPaths = paths.filter((path) => isMarkdownPath(path) || isImagePath(path))
      if (supportedPaths.length > 0) await authorizeDroppedPaths(supportedPaths)
      await openPaths(paths, 'drag-drop')
    }

    void (async () => {
      try {
        unlistenOpenFiles = await listen(OPEN_FILES_EVENT, drainPendingFiles)
        if (disposed) {
          unlistenOpenFiles()
          return
        }
        unlistenDragDrop = await getCurrentWebviewWindow().onDragDropEvent((event) => {
          if (event.payload.type === 'drop') {
            void handleDroppedPaths(event.payload.paths).catch((error) => {
              console.error('[ExternalFileOpen] Failed to process dropped files:', error)
              toast.error(describeFileOperationError(error, '读取拖入文件失败'))
            })
          }
        })
        if (disposed) {
          unlistenDragDrop()
          return
        }
        await drainPendingFiles()
      } catch (error) {
        console.error('[ExternalFileOpen] Failed to initialize:', error)
      }
    })()

    cleanup = () => {
      disposed = true
      unlistenOpenFiles?.()
      unlistenDragDrop?.()
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    stop()
    cleanup?.()
  })
}
