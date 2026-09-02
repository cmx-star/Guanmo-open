<script setup lang="ts">
import { computed, h, type VNode } from 'vue'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

interface MdNode { type: string; value?: string; url?: string; title?: string; alt?: string; lang?: string | null; depth?: number; ordered?: boolean; start?: number; align?: Array<'left' | 'center' | 'right' | null>; children?: MdNode[] }
const props = withDefaults(defineProps<{ content: string; compact?: boolean }>(), { compact: false })
const parser = remark().use(remarkGfm)

type Renderable = VNode | string
function inline(nodes: MdNode[] = []): Renderable[] { return nodes.flatMap((node) => render(node)) }
function render(node: MdNode): Renderable[] {
  const children = inline(node.children)
  switch (node.type) {
    case 'text': return [node.value ?? '']
    case 'paragraph': return [h('p', children)]
    case 'heading': return [h(`h${Math.min(6, Math.max(1, node.depth || 2))}`, children)]
    case 'strong': return [h('strong', children)]
    case 'emphasis': return [h('em', children)]
    case 'delete': return [h('del', children)]
    case 'inlineCode': return [h('code', { class: 'gm-vue-assistant-markdown__inline-code' }, node.value ?? '')]
    case 'code': return [h('div', { class: 'gm-vue-assistant-markdown__code' }, [node.lang ? h('div', { class: 'gm-vue-assistant-markdown__code-language' }, node.lang) : null, h('pre', [h('code', node.value ?? '')])])]
    case 'blockquote': return [h('blockquote', children)]
    case 'list': return [h(node.ordered ? 'ol' : 'ul', { start: node.start }, children)]
    case 'listItem': return [h('li', children)]
    case 'link': return [h('a', { href: node.url, title: node.title, target: '_blank', rel: 'noopener noreferrer' }, children)]
    case 'break': return [h('br')]
    case 'thematicBreak': return [h('hr')]
    case 'table': return [h('div', { class: 'gm-vue-assistant-markdown__table-wrap' }, [h('table', children)])]
    case 'tableRow': return [h('tr', children)]
    case 'tableCell': return [h('td', children)]
    case 'tableHeader': return [h('th', children)]
    case 'image': return [h('img', { src: node.url, alt: node.alt ?? '', title: node.title })]
    default: return children
  }
}

const nodes = computed(() => {
  try { return ((parser.parse(props.content) as unknown as { children?: MdNode[] }).children ?? []).flatMap(render) }
  catch { return [props.content] }
})
const RenderContent = () => h('div', { class: ['gm-vue-assistant-markdown', { 'gm-vue-assistant-markdown--compact': props.compact }] }, nodes.value)
</script>

<template><RenderContent /></template>

<style scoped>
.gm-vue-assistant-markdown { min-width: 0; overflow-wrap: anywhere; color: inherit; line-height: 1.65; }.gm-vue-assistant-markdown :deep(p) { margin: 6px 0; }.gm-vue-assistant-markdown :deep(h1), .gm-vue-assistant-markdown :deep(h2), .gm-vue-assistant-markdown :deep(h3), .gm-vue-assistant-markdown :deep(h4), .gm-vue-assistant-markdown :deep(h5), .gm-vue-assistant-markdown :deep(h6) { margin: 14px 0 6px; color: var(--gm-text); font-size: var(--gm-text-base); }.gm-vue-assistant-markdown :deep(strong) { font-weight: 700; }.gm-vue-assistant-markdown :deep(em) { font-style: italic; }.gm-vue-assistant-markdown :deep(del) { color: var(--gm-text-tertiary); }.gm-vue-assistant-markdown :deep(a) { color: var(--gm-primary); text-decoration: none; }.gm-vue-assistant-markdown :deep(a:hover) { text-decoration: underline; }.gm-vue-assistant-markdown :deep(blockquote) { margin: 8px 0; padding-left: 10px; border-left: 3px solid var(--gm-primary); color: var(--gm-text-secondary); font-style: italic; }.gm-vue-assistant-markdown :deep(ul), .gm-vue-assistant-markdown :deep(ol) { margin: 7px 0; padding-left: 20px; }.gm-vue-assistant-markdown :deep(li) { margin: 2px 0; }.gm-vue-assistant-markdown :deep(hr) { margin: 12px 0; border: 0; border-top: 1px solid var(--gm-border); }.gm-vue-assistant-markdown :deep(img) { max-width: 100%; border-radius: var(--gm-radius-md); }.gm-vue-assistant-markdown__inline-code { padding: 1px 5px; border-radius: var(--gm-radius-sm); color: var(--gm-primary); background: var(--gm-canvas); font-family: var(--gm-font-mono); font-size: .9em; }.gm-vue-assistant-markdown__code { margin: 9px 0; overflow: hidden; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-md); background: var(--gm-canvas); }.gm-vue-assistant-markdown__code-language { padding: 4px 9px; border-bottom: 1px solid var(--gm-border); color: var(--gm-text-secondary); font-family: var(--gm-font-mono); font-size: var(--gm-text-xs); }.gm-vue-assistant-markdown__code pre { max-width: 100%; margin: 0; padding: 10px; overflow-x: auto; }.gm-vue-assistant-markdown__code code { font-family: var(--gm-font-mono); font-size: var(--gm-text-xs); white-space: pre-wrap; }.gm-vue-assistant-markdown__table-wrap { margin: 8px 0; overflow-x: auto; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-md); }.gm-vue-assistant-markdown__table-wrap table { width: 100%; border-collapse: collapse; font-size: var(--gm-text-xs); }.gm-vue-assistant-markdown__table-wrap :deep(th), .gm-vue-assistant-markdown__table-wrap :deep(td) { padding: 5px 7px; border-bottom: 1px solid var(--gm-border-subtle); text-align: left; vertical-align: top; }.gm-vue-assistant-markdown--compact { color: var(--gm-text-secondary); font-size: var(--gm-text-sm); }
</style>
