<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { FilePlus2, FolderOpen, FolderPlus } from 'lucide-vue-next'
import { createFile, createFolder, openFile } from '@/services/fileSystem'
import { readFile } from '@/hooks/useTauri'
import type { FileNode } from '@/services/fileTree'
import { isSameFilePath } from '@/services/pathIdentity'
import { addFileContextTag, summarizeFileWithAi } from '@/services/aiContext'
import { addKnowledgeDocument, isKnowledgeDocumentIndexed } from '@/services/rag/knowledgeBase'
import { isMarkdownPath } from '@/services/rag/indexer'
import { saveExistingFileAs, validateFileName } from '@/services/fileEntryActions'
import { describeFileOperationError } from '@/services/fileOperationErrors'
import { toast } from '@/services/toast'
import { useEditorStore } from '@/stores/editorStore'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { useVueFileRename } from '@/composables/useVueFileRename'
import VueFileTreeNode from './VueFileTreeNode.vue'

const { t } = useI18n()
const props = defineProps<{
  nodes: FileNode[]
  workspacePath?: string | null
  onOpenFile?: (path: string) => void
  onRefreshWorkspace?: () => void
  onCloseWorkspace?: () => void
}>()

const activeFilePath = useZustandSelector(useEditorStore, (state) => state.tabs.find((tab) => tab.id === state.activeTabId)?.filePath ?? null)
const rename = useVueFileRename()
const rootMenu = ref<InstanceType<typeof ContextMenu> | null>(null)
const nodeMenu = ref<InstanceType<typeof ContextMenu> | null>(null)
const menuNode = ref<FileNode | null>(null)
const kbStatus = ref<'idle' | 'checking' | 'not-indexed' | 'indexed' | 'adding'>('idle')
const creating = ref<'file' | 'folder' | null>(null)
const newName = ref('')
const createCancelled = ref(false)
const createSubmitting = ref(false)
const renameState = computed(() => rename.state.value)
const renameSubmitting = computed(() => rename.isSubmitting.value)
function handleNodeClick(node: FileNode): void { props.onOpenFile?.(node.path) }

function showRootMenu(event: MouseEvent): void {
  if (!props.workspacePath || (event.target as HTMLElement).closest('[data-file-tree-node="true"]')) return
  event.preventDefault()
  rootMenu.value?.show(event)
}

function beginCreate(type: 'file' | 'folder'): void {
  createCancelled.value = false
  creating.value = type
  newName.value = type === 'file' ? 'untitled.md' : t('fileTree.newFolder')
}

async function commitCreate(): Promise<void> {
  if (!props.workspacePath || !creating.value || createCancelled.value || createSubmitting.value) return
  const name = newName.value.trim()
  const error = validateFileName(name)
  if (error) { toast.error(error); return }
  createSubmitting.value = true
  try {
    if (creating.value === 'file') {
      const path = await createFile(props.workspacePath, name)
      useEditorStore.getState().addTab(path, name, '')
    } else await createFolder(props.workspacePath, name)
    props.onRefreshWorkspace?.()
    creating.value = null
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('fileTree.createFailed'))
  } finally {
    createSubmitting.value = false
  }
}

async function openEmptyFile(): Promise<void> {
  try {
    const file = await openFile()
    if (!file) return
    const store = useEditorStore.getState()
    const existing = store.tabs.find((tab) => isSameFilePath(tab.filePath, file.path))
    if (existing) store.setActiveTab(existing.id)
    else store.addTab(file.path, file.name, file.content)
  } catch (error) { console.error('Open file failed:', error) }
}

function showNodeMenu(event: MouseEvent, node: FileNode): void {
  if (node.type === 'directory') return
  event.preventDefault()
  menuNode.value = node
  if (!isMarkdownPath(node.path)) { kbStatus.value = 'idle'; nodeMenu.value?.show(event); return }
  kbStatus.value = 'checking'
  void isKnowledgeDocumentIndexed(node.path).then((indexed) => {
    kbStatus.value = indexed ? 'indexed' : 'not-indexed'
  }).catch(() => { kbStatus.value = 'not-indexed' })
  nodeMenu.value?.show(event)
}

async function saveAs(node: FileNode): Promise<void> {
  try { await saveExistingFileAs(node.path); toast.success(t('tabbar.saveAs')) }
  catch (error) { toast.error(describeFileOperationError(error, t('fileTree.saveAsFailed'))) }
}

async function updateKnowledge(node: FileNode): Promise<void> {
  kbStatus.value = 'adding'
  try {
    const result = await addKnowledgeDocument({ filePath: node.path, title: node.name, content: await readFile(node.path) })
    kbStatus.value = result.success ? 'indexed' : 'not-indexed'
    result.success ? toast.success(t('tabbar.addToKnowledgeBase')) : toast.error(result.error || t('fileTree.addToKnowledgeBaseFailed'))
  } catch (error) {
    kbStatus.value = 'not-indexed'
    toast.error(error instanceof Error ? error.message : t('fileTree.addToKnowledgeBaseFailed'))
  }
}

const rootMenuItems = computed<MenuItem[]>(() => [
  { label: t('fileTree.newFile'), icon: 'pi pi-file', command: () => beginCreate('file') },
  { label: t('fileTree.newFolder'), icon: 'pi pi-folder-plus', command: () => beginCreate('folder') },
  { separator: true },
  { label: t('fileTree.refreshWorkspace'), icon: 'pi pi-refresh', command: () => props.onRefreshWorkspace?.() },
  ...(props.onCloseWorkspace ? [{ label: t('fileTree.closeWorkspace'), icon: 'pi pi-times', command: () => props.onCloseWorkspace?.() }] : []),
])

const nodeMenuItems = computed<MenuItem[]>(() => {
  const node = menuNode.value
  if (!node) return []
  const items: MenuItem[] = [
    { label: t('tabbar.rename'), icon: 'pi pi-pencil', command: () => rename.startRename(node.path, node.name) },
    { label: t('tabbar.saveAs'), icon: 'pi pi-save', command: () => void saveAs(node) },
    { separator: true },
    { label: t('tabbar.summarize'), icon: 'pi pi-sparkles', command: () => summarizeFileWithAi({ title: node.name, filePath: node.path }) },
    { label: t('tabbar.addToContext'), icon: 'pi pi-plus-circle', command: () => addFileContextTag({ title: node.name, filePath: node.path }) },
  ]
  if (!isMarkdownPath(node.path)) return items
  items.push({ separator: true })
  if (kbStatus.value === 'checking') items.push({ label: t('tabbar.readingKnowledgeBase'), disabled: true })
  else if (kbStatus.value === 'adding') items.push({ label: t('tabbar.addingKnowledgeBase'), disabled: true })
  else if (kbStatus.value === 'indexed') items.push({ label: t('tabbar.updateKnowledgeBase'), command: () => void updateKnowledge(node) })
  else items.push({ label: t('tabbar.addToKnowledgeBase'), command: () => void updateKnowledge(node) })
  return items
})

function dragStart(event: DragEvent, node: FileNode): void {
  const mime = node.type === 'directory' ? 'application/x-guanmo-folder' : 'application/x-guanmo-file'
  event.dataTransfer?.setData(mime, JSON.stringify({ name: node.name, path: node.path }))
  event.dataTransfer?.setData('text/plain', node.path)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}
</script>

<template>
  <div class="gm-vue-file-tree" @contextmenu="showRootMenu">
    <template v-if="nodes.length">
      <VueFileTreeNode v-for="node in nodes" :key="node.path" :node="node" :depth="0" :active-file-path="activeFilePath" :rename-target-path="renameState.targetId" :rename-value="renameState.value" :rename-submitting="renameSubmitting" @select="handleNodeClick" @context="showNodeMenu($event.event, $event.node)" @drag="dragStart($event.event, $event.node)" @rename-change="rename.setRenameValue" @rename-submit="rename.submitRename($event.path, $event.path, onRefreshWorkspace)" @rename-cancel="rename.cancelRename($event.path)" />
    </template>
    <div v-else class="gm-vue-file-tree__empty"><FolderOpen :size="30" aria-hidden="true" /><p>{{ t('fileTree.noFiles') }}</p><button type="button" @click="openEmptyFile">{{ t('common.open') }}</button></div>
    <div v-if="creating" class="gm-vue-file-tree__create"><component :is="creating === 'file' ? FilePlus2 : FolderPlus" :size="14" aria-hidden="true" /><input autofocus :value="newName" @focus="($event.target as HTMLInputElement).select()" @input="newName = ($event.target as HTMLInputElement).value" @blur="commitCreate" @keydown.enter.prevent="commitCreate" @keydown.esc="createCancelled = true; creating = null" /></div>
    <ContextMenu ref="rootMenu" :model="rootMenuItems" />
    <ContextMenu ref="nodeMenu" :model="nodeMenuItems" />
  </div>
</template>

<style scoped>
.gm-vue-file-tree { min-height: 160px; padding: 4px 0; }.gm-vue-file-tree__node { display: flex; min-width: 0; align-items: center; gap: 6px; min-height: 27px; padding-right: 8px; color: var(--gm-text-secondary); border-radius: var(--gm-radius-sm); cursor: pointer; font-size: 12px; }.gm-vue-file-tree__node:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-file-tree__node--active { color: var(--gm-text); background: var(--gm-primary-subtle); font-weight: 700; }.gm-vue-file-tree__chevron--open { transform: rotate(90deg); }.gm-vue-file-tree__name,.gm-vue-file-tree__rename { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.gm-vue-file-tree__rename input,.gm-vue-file-tree__create input { width: 100%; color: var(--gm-text); background: var(--gm-canvas); border: 1px solid var(--gm-primary); border-radius: var(--gm-radius-sm); outline: 0; }.gm-vue-file-tree__empty { display: grid; justify-items: center; gap: 6px; padding: 24px 16px; color: var(--gm-text-tertiary); font-size: 12px; text-align: center; }.gm-vue-file-tree__empty button { color: var(--gm-primary); background: transparent; border: 0; cursor: pointer; }.gm-vue-file-tree__create { display: flex; align-items: center; gap: 6px; padding: 5px 8px; color: var(--gm-text-secondary); }
</style>
