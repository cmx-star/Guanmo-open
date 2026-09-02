import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

export function buildMarkdownEditorTheme(fontSize: number, lineHeight: number, fontFamily: string) {
  return EditorView.theme({
    '&': { backgroundColor: 'var(--gm-editor-bg)', color: 'var(--gm-text)', fontSize: `${fontSize}px`, height: '100%' },
    '.cm-content': { fontFamily, lineHeight: String(lineHeight), padding: '12px 0', caretColor: 'var(--gm-primary)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--gm-primary)', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--gm-editor-selection) !important' },
    '.cm-activeLine': { backgroundColor: 'var(--gm-editor-line-highlight)' },
    '.cm-gutters': { backgroundColor: 'var(--gm-canvas)', color: 'var(--gm-text-tertiary)', border: 'none', borderRight: '1px solid var(--gm-border)', minWidth: '44px', maxWidth: '88px' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--gm-text)' }, '.cm-foldGutter': { color: 'var(--gm-text-tertiary)' },
    '.cm-header': { color: 'var(--gm-editor-heading)', fontWeight: '700' }, '.cm-header-1': { fontSize: '1.4em' }, '.cm-header-2': { fontSize: '1.25em' }, '.cm-header-3': { fontSize: '1.15em' },
    '.cm-emphasis': { fontStyle: 'italic', color: 'var(--gm-text)' }, '.cm-strong': { fontWeight: '700', color: 'var(--gm-editor-heading)' }, '.cm-strikethrough': { textDecoration: 'line-through', color: 'var(--gm-text-secondary)' },
    '.cm-url': { color: 'var(--gm-editor-link)', textDecoration: 'underline' }, '.cm-link': { color: 'var(--gm-editor-link)' }, '.cm-quote': { color: 'var(--gm-editor-quote)', fontStyle: 'italic' }, '.cm-list': { color: 'var(--gm-editor-list)', fontWeight: '600' }, '.cm-hr': { color: 'var(--gm-border)' },
    '.cm-inline-code': { backgroundColor: 'var(--gm-surface-elevated)', color: 'var(--gm-editor-code)', padding: '1px 6px', borderRadius: '12px', fontSize: '0.9em' }, '.cm-codeblock': { backgroundColor: 'var(--gm-code-bg)', color: 'var(--gm-code-text)' },
    '.cm-tooltip': { backgroundColor: 'var(--gm-surface)', border: '1px solid var(--gm-border)', borderRadius: '16px', boxShadow: '0 4px 12px color-mix(in srgb, var(--gm-text) 10%, transparent)' }, '.cm-tooltip-autocomplete': { '& > ul > li': { padding: '4px 8px' }, '& > ul > li[aria-selected]': { backgroundColor: 'var(--gm-primary-subtle)', color: 'var(--gm-text)' } },
    '.cm-panels': { backgroundColor: 'var(--gm-surface)', color: 'var(--gm-text)', borderTop: '1px solid var(--gm-border)' }, '.cm-panel input': { backgroundColor: 'var(--gm-surface-elevated)', color: 'var(--gm-text)', border: '1px solid var(--gm-border)', borderRadius: '12px', padding: '4px 8px' }, '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--gm-warning) 20%, transparent)' }, '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--gm-warning) 40%, transparent)' },
  })
}

export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--gm-editor-heading)', fontWeight: '700' }, { tag: tags.quote, color: 'var(--gm-editor-quote)', fontStyle: 'italic' }, { tag: tags.monospace, color: 'var(--gm-editor-code)' }, { tag: tags.link, color: 'var(--gm-editor-link)' }, { tag: tags.url, color: 'var(--gm-editor-link)', textDecoration: 'underline' }, { tag: tags.list, color: 'var(--gm-editor-list)', fontWeight: '600' }, { tag: tags.strong, color: 'var(--gm-editor-heading)', fontWeight: '700' }, { tag: tags.emphasis, fontStyle: 'italic' }, { tag: tags.strikethrough, color: 'var(--gm-text-secondary)', textDecoration: 'line-through' }, { tag: tags.processingInstruction, color: 'var(--gm-text-tertiary)' },
])
