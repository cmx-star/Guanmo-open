<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { editorCodeLanguages } from '@/services/editorCodeLanguages'
import type { PreviewBlock } from '@/services/markdownPreviewModel'
import { buildMarkdownEditorTheme, markdownHighlightStyle } from './markdownEditorTheme'

const { t } = useI18n()
const props = defineProps<{ block: PreviewBlock; initialCursor: number; fontSize: number; lineHeight: number; fontFamily: string; wordWrap: boolean; conflict: boolean; onDraftChange: (draft: string) => void; onSubmit: (draft: string) => void; onCopyDraft: (draft: string) => void }>()
const host = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null
let composing = false
function dispose(): void { view?.destroy(); view = null }
function create(): void {
  if (!host.value) return
  dispose()
  const submit = (active: EditorView) => { if (active.composing || composing) return false; props.onSubmit(active.state.doc.toString()); return true }
  const state = EditorState.create({ doc: props.block.rawSource, selection: { anchor: Math.max(0, Math.min(props.initialCursor, props.block.rawSource.length)) }, extensions: [
    history(), bracketMatching(), syntaxHighlighting(markdownHighlightStyle), syntaxHighlighting(defaultHighlightStyle, { fallback: true }), markdown({ base: markdownLanguage, codeLanguages: editorCodeLanguages }), buildMarkdownEditorTheme(props.fontSize, props.lineHeight, props.fontFamily), EditorView.theme({ '& .cm-content': { padding: '8px 12px' }, '.cm-gutters': { display: 'none' }, '.cm-activeLine': { backgroundColor: 'transparent' } }), props.wordWrap ? EditorView.lineWrapping : [],
    EditorView.updateListener.of((update) => { if (update.docChanged) props.onDraftChange(update.state.doc.toString()) }), EditorView.domEventHandlers({ compositionstart() { composing = true; return false }, compositionend() { composing = false; return false }, keydown(event) { return composing || event.isComposing || event.keyCode === 229 } }), keymap.of([{ key: 'Ctrl-s', run: (active) => { if (!submit(active)) return false; queueMicrotask(() => window.dispatchEvent(new CustomEvent('cm-save'))); return true } }, indentWithTab, ...defaultKeymap, ...historyKeymap]),
  ] })
  view = new EditorView({ state, parent: host.value }); queueMicrotask(() => view?.focus())
}
function copyDraft(): void { props.onCopyDraft(view?.state.doc.toString() ?? props.block.rawSource) }
watch(() => props.block.blockId, create)
onMounted(create); onBeforeUnmount(dispose)
</script>
<template><div class="gm-inline-markdown-editor" :class="{ 'gm-inline-markdown-editor--conflict': conflict }"><div v-if="conflict" class="gm-inline-markdown-editor__status"><span class="text-gm-error">{{ t('inlineEditor.conflict') }}</span><button type="button" @click="copyDraft">{{ t('inlineEditor.copyDraft') }}</button></div><div ref="host" class="gm-inline-markdown-editor__host" /></div></template>
