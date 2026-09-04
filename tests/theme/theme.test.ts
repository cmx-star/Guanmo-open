import { describe, expect, it } from 'vitest'
import { applyDocumentTheme, normalizeThemeId, resolvePersistedTheme } from '@/theme/theme'

describe('theme compatibility', () => {
  it('maps legacy theme values to the fixed token contract', () => {
    expect(normalizeThemeId('dark')).toBe('ink-dark')
    expect(normalizeThemeId('warm')).toBe('ink-light')
    expect(normalizeThemeId('ink-dark')).toBe('ink-dark')
  })

  it('reads a legacy persisted appearance safely', () => {
    const storage = new Map<string, string>([
      ['guanmo-settings', JSON.stringify({ state: { appearance: { themeId: 'dark' } } })],
    ])
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
    } as Storage

    expect(resolvePersistedTheme(mockStorage)).toBe('ink-dark')
  })

  it('defaults to dark when nothing is persisted', () => {
    const emptyStorage = { getItem: () => null } as Storage
    expect(resolvePersistedTheme(emptyStorage)).toBe('ink-dark')
    expect(resolvePersistedTheme(null)).toBe('ink-dark')
  })

  it('writes only the fixed theme id and mode to the document', () => {
    const root = document.createElement('html')
    applyDocumentTheme('ink-light', root)

    expect(root.dataset.themeId).toBe('ink-light')
    expect(root.dataset.theme).toBe('light')
    expect(root.style.colorScheme).toBe('light')
  })
})
