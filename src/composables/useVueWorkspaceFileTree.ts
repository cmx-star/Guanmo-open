import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { joinPath } from '@/hooks/useTauri'
import { listDirectory } from '@/services/fileSystem'
import { isWorkspaceDisplayFile, shouldSkipWorkspaceDirectory, type FileNode } from '@/services/fileTree'
import { recoverRememberedWorkspace } from '@/services/persistedFileAccess'
import { useAppStore, type WorkspaceRoot } from '@/stores/appStore'
import { useZustandSelector } from './useZustandSelector'

export interface WorkspaceTreeState {
  nodes: FileNode[]
  hiddenCount: number
  loading: boolean
  error: string | null
}

const EMPTY_TREE: WorkspaceTreeState = { nodes: [], hiddenCount: 0, loading: false, error: null }

export function useVueWorkspaceFileTree() {
  const workspaceRoots = useZustandSelector(useAppStore, (state) => state.workspaceRoots)
  const workspaceTrees = shallowRef<Record<string, WorkspaceTreeState>>({})

  async function readDirectory(path: string, depth: number): Promise<{ nodes: FileNode[]; hidden: number }> {
    if (depth > 5) return { nodes: [], hidden: 0 }
    const entries = await listDirectory(path)
    const nodes: FileNode[] = []
    let hidden = 0
    for (const entry of entries) {
      const fullPath = await joinPath(path, entry.name)
      if (entry.isDirectory) {
        if (shouldSkipWorkspaceDirectory(entry.name)) { hidden += 1; continue }
        const nested = await readDirectory(fullPath, depth + 1)
        nodes.push({ name: entry.name, path: fullPath, type: 'directory', children: nested.nodes })
        hidden += nested.hidden
      } else if (isWorkspaceDisplayFile(entry.name)) {
        nodes.push({ name: entry.name, path: fullPath, type: 'file', extension: entry.name.split('.').pop()?.toLowerCase() })
      } else hidden += 1
    }
    nodes.sort((left, right) => {
      if (left.type === 'directory' && right.type !== 'directory') return -1
      if (left.type !== 'directory' && right.type === 'directory') return 1
      return left.name.localeCompare(right.name)
    })
    return { nodes, hidden }
  }

  async function loadWorkspaceRoot(root: WorkspaceRoot): Promise<void> {
    workspaceTrees.value = { ...workspaceTrees.value, [root.id]: { ...(workspaceTrees.value[root.id] ?? EMPTY_TREE), loading: true, error: null } }
    try {
      const { nodes, hidden } = await recoverRememberedWorkspace(root.path, () => readDirectory(root.path, 0))
      if (!useAppStore.getState().workspaceRoots.some((item) => item.id === root.id)) return
      workspaceTrees.value = { ...workspaceTrees.value, [root.id]: { nodes, hiddenCount: hidden, loading: false, error: null } }
    } catch (error) {
      if (!useAppStore.getState().workspaceRoots.some((item) => item.id === root.id)) return
      workspaceTrees.value = { ...workspaceTrees.value, [root.id]: { ...(workspaceTrees.value[root.id] ?? EMPTY_TREE), loading: false, error: error instanceof Error ? error.message : String(error) || '工作区加载失败' } }
    }
  }

  async function refreshWorkspaceRoot(id: string): Promise<void> {
    const root = useAppStore.getState().workspaceRoots.find((item) => item.id === id)
    if (root) await loadWorkspaceRoot(root)
  }

  async function refreshAllWorkspaces(): Promise<void> {
    for (const root of useAppStore.getState().workspaceRoots) await loadWorkspaceRoot(root)
  }

  function removeWorkspace(id: string): void {
    useAppStore.getState().removeWorkspaceRoot(id)
    const next = { ...workspaceTrees.value }
    delete next[id]
    workspaceTrees.value = next
  }

  watch(workspaceRoots, (roots) => {
    const ids = new Set(roots.map((root) => root.id))
    workspaceTrees.value = Object.fromEntries(Object.entries(workspaceTrees.value).filter(([id]) => ids.has(id)))
    void Promise.all(roots.map(loadWorkspaceRoot))
  }, { immediate: true })

  const refreshHandler = () => { void refreshAllWorkspaces() }
  window.addEventListener('guanmo:workspace-refresh', refreshHandler)
  onBeforeUnmount(() => window.removeEventListener('guanmo:workspace-refresh', refreshHandler))

  return {
    workspaceRoots,
    workspaceTrees,
    addWorkspaceRoot: useAppStore.getState().addWorkspaceRoot,
    removeWorkspace,
    refreshWorkspaceRoot,
    refreshAllWorkspaces,
  }
}
