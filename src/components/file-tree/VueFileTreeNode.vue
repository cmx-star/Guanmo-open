<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, FileText, Folder } from 'lucide-vue-next'
import type { FileNode } from '@/services/fileTree'
import { isSameFilePath } from '@/services/pathIdentity'

defineOptions({ name: 'VueFileTreeNode' })

const props = defineProps<{
  node: FileNode
  depth: number
  activeFilePath: string | null
  renameTargetPath: string | null
  renameValue: string
  renameSubmitting: boolean
}>()

const emit = defineEmits<{
  select: [node: FileNode]
  context: [payload: { event: MouseEvent; node: FileNode }]
  drag: [payload: { event: DragEvent; node: FileNode }]
  'rename-change': [value: string]
  'rename-submit': [node: FileNode]
  'rename-cancel': [node: FileNode]
}>()

const expanded = ref(props.depth === 0)
const isDirectory = computed(() => props.node.type === 'directory')
const renaming = computed(() => props.renameTargetPath === props.node.path)

function clickNode(): void {
  if (isDirectory.value) expanded.value = !expanded.value
  else emit('select', props.node)
}
</script>

<template>
  <div>
    <div
      class="gm-vue-file-tree__node"
      :class="{ 'gm-vue-file-tree__node--active': !isDirectory && isSameFilePath(activeFilePath, node.path) }"
      data-file-tree-node="true"
      draggable="true"
      :style="{ paddingLeft: `${8 + depth * 12}px` }"
      @click="clickNode"
      @contextmenu="emit('context', { event: $event, node })"
      @dragstart="emit('drag', { event: $event, node })"
    >
      <ChevronRight v-if="isDirectory" :size="14" :class="{ 'gm-vue-file-tree__chevron--open': expanded }" aria-hidden="true" />
      <Folder v-else-if="isDirectory" :size="14" aria-hidden="true" />
      <FileText v-else :size="14" aria-hidden="true" />
      <span v-if="renaming" class="gm-vue-file-tree__rename" @click.stop>
        <input autofocus :value="renameValue" :disabled="renameSubmitting" @focus="($event.target as HTMLInputElement).select()" @input="emit('rename-change', ($event.target as HTMLInputElement).value)" @blur="emit('rename-submit', node)" @keydown.enter.prevent="emit('rename-submit', node)" @keydown.esc="emit('rename-cancel', node)" />
      </span>
      <span v-else class="gm-vue-file-tree__name" :title="node.name">{{ node.name }}</span>
    </div>
    <div v-if="isDirectory && expanded" class="gm-vue-file-tree__children">
      <VueFileTreeNode
        v-for="child in node.children ?? []"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :active-file-path="activeFilePath"
        :rename-target-path="renameTargetPath"
        :rename-value="renameValue"
        :rename-submitting="renameSubmitting"
        @select="emit('select', $event)"
        @context="emit('context', $event)"
        @drag="emit('drag', $event)"
        @rename-change="emit('rename-change', $event)"
        @rename-submit="emit('rename-submit', $event)"
        @rename-cancel="emit('rename-cancel', $event)"
      />
    </div>
  </div>
</template>
