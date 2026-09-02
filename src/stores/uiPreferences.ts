import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { applyDocumentTheme, resolvePersistedTheme, type ThemeId } from '@/theme/theme'

const WEB_THEME_KEY = 'guanmo-web-theme'
const LOCALE_KEY = 'guanmo-locale'

export type AppLocale = 'zh-CN' | 'en-US'

function resolvePersistedLocale(): AppLocale {
  if (typeof localStorage === 'undefined') return 'zh-CN'
  return localStorage.getItem(LOCALE_KEY) === 'en-US' ? 'en-US' : 'zh-CN'
}

export const useUiPreferencesStore = defineStore('ui-preferences', () => {
  const themeId = ref<ThemeId>(resolvePersistedTheme())
  const locale = ref<AppLocale>(resolvePersistedLocale())
  const isDark = computed(() => themeId.value === 'ink-dark')

  watch(themeId, (nextThemeId) => {
    applyDocumentTheme(nextThemeId)
    localStorage.setItem(WEB_THEME_KEY, nextThemeId)
  }, { immediate: true })

  watch(locale, (nextLocale) => {
    document.documentElement.lang = nextLocale
    localStorage.setItem(LOCALE_KEY, nextLocale)
  }, { immediate: true })

  function toggleTheme(): void {
    themeId.value = themeId.value === 'ink-dark' ? 'ink-light' : 'ink-dark'
  }

  return { themeId, locale, isDark, toggleTheme }
})
