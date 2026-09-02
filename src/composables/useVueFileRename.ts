import { computed, ref } from 'vue'
import { renameFileEntry, validateFileName } from '@/services/fileEntryActions'
import { toast } from '@/services/toast'
import {
  INITIAL_RENAME_STATE,
  isRenameTargetActive,
  renameStateReducer,
  type RenameAction,
} from '@/services/renameState'

export function useVueFileRename() {
  const state = ref(INITIAL_RENAME_STATE)

  function transition(action: RenameAction): void {
    state.value = renameStateReducer(state.value, action)
  }

  function startRename(targetId: string, value: string): void {
    transition({ type: 'start', targetId, value })
  }

  function setRenameValue(value: string): void {
    transition({ type: 'change', value })
  }

  function cancelRename(targetId: string): void {
    if (!isRenameTargetActive(state.value, targetId)) return
    transition({ type: 'cancel' })
  }

  async function submitRename(targetId: string, path: string, onSuccess?: () => void): Promise<boolean> {
    const current = state.value
    if (!isRenameTargetActive(current, targetId) || current.status === 'submitting') return false

    const error = validateFileName(current.value)
    if (error) {
      transition({ type: 'fail' })
      toast.error(error)
      return false
    }

    transition({ type: 'submit' })
    try {
      await renameFileEntry(path, current.value)
    } catch (error) {
      transition({ type: 'fail' })
      toast.error(error instanceof Error ? error.message : '重命名失败')
      return false
    }

    transition({ type: 'succeed' })
    onSuccess?.()
    toast.success('已重命名')
    return true
  }

  return {
    state,
    isSubmitting: computed(() => state.value.status === 'submitting'),
    startRename,
    setRenameValue,
    cancelRename,
    submitRename,
    isRenaming: (targetId: string) => isRenameTargetActive(state.value, targetId),
  }
}
