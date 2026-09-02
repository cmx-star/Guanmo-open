export const THEME_IDS = ['ink-light', 'ink-dark'] as const

export type ThemeId = typeof THEME_IDS[number]
export type ThemeMode = 'light' | 'dark'

const LEGACY_DARK_THEME = 'dark'

export function normalizeThemeId(value: unknown): ThemeId {
  return value === 'ink-dark' || value === LEGACY_DARK_THEME ? 'ink-dark' : 'ink-light'
}

export function getThemeMode(themeId: ThemeId): ThemeMode {
  return themeId === 'ink-dark' ? 'dark' : 'light'
}

export function applyDocumentTheme(themeId: ThemeId, root: HTMLElement = document.documentElement): void {
  const mode = getThemeMode(themeId)
  root.dataset.themeId = themeId
  root.dataset.theme = mode
  root.style.colorScheme = mode
}

export function resolvePersistedTheme(storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): ThemeId {
  if (!storage) return 'ink-light'

  try {
    const persisted = JSON.parse(storage.getItem('guanmo-settings') ?? 'null') as {
      state?: { appearance?: { themeId?: unknown; theme?: unknown } }
    } | null
    const appearance = persisted?.state?.appearance
    if (appearance) return normalizeThemeId(appearance.themeId ?? appearance.theme)

    return normalizeThemeId(storage.getItem('guanmo-web-theme'))
  } catch {
    return 'ink-light'
  }
}
