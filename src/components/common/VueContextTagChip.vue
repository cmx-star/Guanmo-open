<script setup lang="ts">
import { Brain, FileText, Folder, Globe2, PenLine, X } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { ContextTag, ContextTagType } from '@/types/contextTag'

const props = defineProps<{ tag: ContextTag; onRemove: (id: string) => void }>()
const icons: Record<ContextTagType, Component> = { selection: PenLine, file: FileText, folder: Folder, memory: Brain, web: Globe2 }
function label(tag: ContextTag): string {
  if (tag.type === 'selection') return tag.startLine ? `${tag.title} · L${tag.startLine}${tag.endLine ? `-${tag.endLine}` : ''}` : `${tag.title} · selection`
  if (tag.type === 'memory') return 'Memory'
  return tag.title || (tag.type === 'web' ? 'Web' : '')
}
function tooltip(tag: ContextTag): string { return [tag.preview, tag.filePath || tag.folderPath, tag.startLine ? `L${tag.startLine}${tag.endLine ? `-${tag.endLine}` : ''}` : ''].filter(Boolean).join('\n') }
</script>

<template>
  <span class="gm-vue-context-tag" :title="tooltip(props.tag)"><component :is="icons[props.tag.type]" :size="12" aria-hidden="true" /><span>{{ label(props.tag) }}</span><button type="button" :aria-label="`Remove ${label(props.tag)}`" @click.stop="props.onRemove(props.tag.id)"><X :size="11" aria-hidden="true" /></button></span>
</template>

<style scoped>
.gm-vue-context-tag { display: inline-flex; max-width: 220px; align-items: center; gap: 4px; padding: 2px 6px 2px 7px; border: 1px solid var(--gm-border); border-radius: 999px; color: var(--gm-primary); background: var(--gm-surface-elevated); box-shadow: var(--gm-shadow-sm); font-size: var(--gm-text-xs); }.gm-vue-context-tag > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.gm-vue-context-tag button { display: grid; width: 16px; height: 16px; flex: 0 0 auto; padding: 0; place-items: center; border: 0; border-radius: 50%; color: inherit; background: transparent; cursor: pointer; }.gm-vue-context-tag button:hover { background: color-mix(in srgb, var(--gm-primary) 18%, transparent); }
</style>
