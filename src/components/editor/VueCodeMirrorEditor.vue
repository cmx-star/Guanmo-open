<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorState, EditorSelection, type Text } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, undoDepth, redoDepth } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { highlightSelectionMatches } from '@codemirror/search'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentUnit } from '@codemirror/language'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { setActiveEditorView } from '@/services/editorViewRef'
import { useEditorHistoryStore } from '@/stores/editorHistoryStore'
import { DeferredContentEmitter } from '@/services/editorInputBuffer'
import { editorCodeLanguages } from '@/services/editorCodeLanguages'
import { eventMarker } from '@/services/eventMarker'
import { buildMarkdownEditorTheme, markdownHighlightStyle } from './markdownEditorTheme'
import { useZustandSelector } from '@/composables/useZustandSelector'

const props = withDefaults(defineProps<{
  content: string
  onChange: (content: string) => void
  onSave?: () => void
  onImageFiles?: (files: File[], insertAt?: number) => void
  onViewChange?: (view: EditorView | null) => void
  onBeforeDestroy?: (documentKey: string | null | undefined, view: EditorView) => void
  documentKey?: string | null
  tabId?: string | null
  initialScrollTop?: number
  initialCursor?: number
  initialSelection?: { anchor: number; head: number }
  initialRanges?: Array<{ anchor: number; head: number }>
  initialMainIndex?: number
  resource?: 'editor'
}>(), { onSave: undefined, onImageFiles: undefined, onViewChange: undefined, onBeforeDestroy: undefined, documentKey: null, tabId: null, initialScrollTop: undefined, initialCursor: undefined, initialSelection: undefined, initialRanges: undefined, initialMainIndex: undefined, resource: 'editor' })

const container = ref<HTMLDivElement | null>(null)
const editorSettings = useZustandSelector(useSettingsStore, (state) => state.editor)
const pendingReveal = useZustandSelector(useEditorStore, (state) => state.pendingReveal)
let view: EditorView | null = null
let buffer: DeferredContentEmitter<Text> | null = null
let lastContent = props.content
let stopSave: (() => void) | null = null
let gutterObserver: ResizeObserver | null = null

function imageFile(file: File): boolean { return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name) }
const saveKeymap = keymap.of([{ key: 'Ctrl-s', run: () => { window.dispatchEvent(new CustomEvent('cm-save')); return true } }])
function dispose(reason: string): void {
  buffer?.flush(); buffer?.dispose(); buffer = null
  if (!view) return
  gutterObserver?.disconnect(); gutterObserver = null
  props.onBeforeDestroy?.(props.documentKey, view)
  view.destroy(); eventMarker.mark('model-dispose', { editor: 'codemirror', reason, resource: props.resource, documentKey: props.documentKey }); eventMarker.mark('editor-dispose', { editor: 'codemirror', reason, resource: props.resource, documentKey: props.documentKey }); view = null
  props.onViewChange?.(null)
  setActiveEditorView(null); useEditorHistoryStore.getState().setCanUndo(false); useEditorHistoryStore.getState().setCanRedo(false)
}
function create(): void {
  if (!container.value) return
  dispose('recreate')
  const settings = editorSettings.value
  buffer = new DeferredContentEmitter<Text>((doc) => doc.toString(), (content) => { lastContent = content; props.onChange(content) })
  const listener = EditorView.updateListener.of((update) => { if (update.docChanged) buffer?.push(update.state.doc, update.state.doc.length); const historyState = useEditorHistoryStore.getState(); historyState.setCanUndo(undoDepth(update.state) > 0); historyState.setCanRedo(redoDepth(update.state) > 0) })
  const state = EditorState.create({ doc: props.content, extensions: [
    settings.lineNumbers ? lineNumbers() : [], highlightActiveLine(), highlightActiveLineGutter(), history(), bracketMatching(), closeBrackets(), autocompletion(), highlightSelectionMatches(), syntaxHighlighting(markdownHighlightStyle), syntaxHighlighting(defaultHighlightStyle, { fallback: true }), markdown({ base: markdownLanguage, codeLanguages: editorCodeLanguages }), EditorState.languageData.of(() => [{ closeBrackets: { brackets: ['(', '[', '{', "'", '"', '`'] } }]), indentUnit.of(' '.repeat(settings.tabSize)), buildMarkdownEditorTheme(settings.fontSize, settings.lineHeight, settings.fontFamily), saveKeymap, listener,
    EditorView.domEventHandlers({ drop(event, active) { const files = Array.from(event.dataTransfer?.files ?? []).filter(imageFile); if (!files.length) return false; event.preventDefault(); props.onImageFiles?.(files, active.posAtCoords({ x: event.clientX, y: event.clientY }) ?? active.state.selection.main.from); return true }, paste(event, active) { const files = Array.from(event.clipboardData?.files ?? []).filter(imageFile); if (!files.length) return false; event.preventDefault(); props.onImageFiles?.(files, active.state.selection.main.from); return true } }),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...completionKeymap, ...closeBracketsKeymap]), keymap.of([{ key: 'Ctrl-f', run: () => true }, { key: 'Ctrl-h', run: () => true }, { key: 'Ctrl-g', run: () => true }, { key: 'F3', run: () => true }]), settings.wordWrap ? EditorView.lineWrapping : [], EditorState.allowMultipleSelections.of(true),
  ] })
  view = new EditorView({ state, parent: container.value }); lastContent = props.content; setActiveEditorView(view); props.onViewChange?.(view); eventMarker.mark('editor-create', { editor: 'codemirror', resource: props.resource, documentKey: props.documentKey }); eventMarker.mark('model-create', { editor: 'codemirror', charCount: state.doc.length, resource: props.resource, documentKey: props.documentKey })
  if (typeof props.initialScrollTop === 'number') view.scrollDOM.scrollTop = props.initialScrollTop
  const clip = (position: number) => Math.max(0, Math.min(position, view!.state.doc.length))
  if (props.initialRanges?.length) {
    const ranges = props.initialRanges.map((range) => EditorSelection.range(clip(range.anchor), clip(range.head)))
    view.dispatch({ selection: EditorSelection.create(ranges, Math.min(props.initialMainIndex ?? ranges.length - 1, ranges.length - 1)) })
  } else if (props.initialSelection) view.dispatch({ selection: { anchor: clip(props.initialSelection.anchor), head: clip(props.initialSelection.head) } })
  else if (typeof props.initialCursor === 'number') view.dispatch({ selection: { anchor: clip(props.initialCursor) } })
  const gutters = view.dom.querySelector<HTMLElement>('.cm-gutters')
  const syncGutter = () => { if (!container.value) return; if (gutters) container.value.style.setProperty('--gm-cm-gutter-width', `${gutters.getBoundingClientRect().width}px`); else container.value.style.removeProperty('--gm-cm-gutter-width') }
  syncGutter(); if (gutters) { gutterObserver = new ResizeObserver(syncGutter); gutterObserver.observe(gutters) }
}
watch(() => `${props.documentKey}:${editorSettings.value.fontSize}-${editorSettings.value.lineHeight}-${editorSettings.value.fontFamily}-${editorSettings.value.wordWrap}-${editorSettings.value.lineNumbers}-${editorSettings.value.tabSize}`, create)
watch(() => props.content, (content) => { if (!view || content === lastContent) return; if (buffer?.hasPending) { buffer.flush(); return }; const current = view.state.doc.toString(); if (current !== content) { view.dispatch({ changes: { from: 0, to: current.length, insert: content } }); lastContent = content } })
watch(pendingReveal, (reveal) => { if (!view || !reveal || reveal.tabId !== props.tabId) return; const start = Math.max(1, Math.min(reveal.startLine, view.state.doc.lines)); const end = Math.max(start, Math.min(reveal.endLine ?? reveal.startLine, view.state.doc.lines)); const from = view.state.doc.line(start).from; view.dispatch({ selection: { anchor: from, head: view.state.doc.line(end).to }, effects: EditorView.scrollIntoView(from, { y: 'start' }) }); view.focus(); useEditorStore.getState().clearPendingReveal() })
onMounted(() => { create(); const save = () => { buffer?.flush(); props.onSave?.() }; window.addEventListener('cm-save', save); stopSave = () => window.removeEventListener('cm-save', save) })
onBeforeUnmount(() => { stopSave?.(); dispose('unmount') })
</script>

<template><div ref="container" class="h-full overflow-hidden" /></template>
