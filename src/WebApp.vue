<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpenText, Download, Globe2, MoonStar, SunMedium } from 'lucide-vue-next'
import { useUiPreferencesStore, type AppLocale } from './stores/uiPreferences'

const { t, locale } = useI18n()
const preferences = useUiPreferencesStore()

const languageOptions: Array<{ label: string; value: AppLocale }> = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
]

watch(() => preferences.locale, (nextLocale) => {
  locale.value = nextLocale
}, { immediate: true })

function openDesktopRelease(): void {
  window.open('https://github.com/we-used-to-be/Guanmo-open/releases/latest', '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <main class="gm-web-shell">
    <header class="gm-web-menubar">
      <div class="gm-web-brand" :aria-label="t('app.name')">
        <span class="gm-web-brand-mark" aria-hidden="true">观</span>
        <span class="gm-web-brand-name">{{ t('app.name') }}</span>
        <span class="gm-web-brand-divider" aria-hidden="true"></span>
        <span class="gm-web-brand-tagline">{{ t('app.tagline') }}</span>
        <span class="gm-web-menu-label">{{ t('menu.product') }}</span>
      </div>
      <div class="gm-web-actions">
        <button
          class="gm-web-icon-button"
          type="button"
          :aria-label="t('web.switchTheme')"
          :title="t('web.switchTheme')"
          @click="preferences.toggleTheme"
        >
          <MoonStar v-if="!preferences.isDark" :size="18" aria-hidden="true" />
          <SunMedium v-else :size="18" aria-hidden="true" />
        </button>
        <label class="gm-web-locale">
          <Globe2 :size="16" aria-hidden="true" />
          <span class="sr-only">{{ t('web.switchLanguage') }}</span>
          <select v-model="preferences.locale" :aria-label="t('web.switchLanguage')">
            <option v-for="option in languageOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
    </header>

    <section class="gm-web-content" aria-labelledby="web-title">
      <div class="gm-web-content-copy">
        <div class="gm-web-kicker">
          <BookOpenText :size="18" aria-hidden="true" />
          <span>{{ t('web.desktopOnly') }}</span>
        </div>
        <h1 id="web-title">{{ t('web.title') }}</h1>
        <p>{{ t('web.description') }}</p>
        <button class="gm-web-primary-button" type="button" @click="openDesktopRelease">
          <Download :size="18" aria-hidden="true" />
          <span>{{ t('menu.download') }}</span>
        </button>
      </div>
      <div class="gm-web-document" aria-hidden="true">
        <div class="gm-web-document-tabs">
          <span></span><span></span><span></span>
        </div>
        <div class="gm-web-document-title"></div>
        <div class="gm-web-document-line gm-web-document-line--long"></div>
        <div class="gm-web-document-line"></div>
        <div class="gm-web-document-line gm-web-document-line--short"></div>
        <div class="gm-web-document-code">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.gm-web-shell { display: grid; min-height: 100vh; grid-template-rows: auto minmax(0, 1fr); }
.gm-web-menubar { display: flex; min-height: 54px; padding: 0 var(--gm-space-5); align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gm-border); background: color-mix(in srgb, var(--gm-surface) 94%, transparent); }
.gm-web-brand, .gm-web-actions, .gm-web-locale, .gm-web-kicker { display: flex; align-items: center; }
.gm-web-brand { min-width: 0; gap: var(--gm-space-2); }
.gm-web-brand-mark { display: grid; width: 26px; height: 26px; place-items: center; color: var(--gm-text-inverse); background: var(--gm-primary); border-radius: var(--gm-radius-sm); font-size: var(--gm-text-sm); font-weight: 700; }
.gm-web-brand-name { color: var(--gm-text); font-size: var(--gm-text-lg); font-weight: 700; }
.gm-web-brand-divider { width: 1px; height: 14px; background: var(--gm-border); }
.gm-web-brand-tagline { overflow: hidden; color: var(--gm-text-muted); font-size: var(--gm-text-sm); text-overflow: ellipsis; white-space: nowrap; }
.gm-web-menu-label { margin-left: var(--gm-space-3); color: var(--gm-text-secondary); font-size: var(--gm-text-sm); }
.gm-web-actions { gap: var(--gm-space-2); }
.gm-web-locale { gap: var(--gm-space-1); color: var(--gm-text-muted); }
.gm-web-icon-button { display: grid; width: 32px; height: 32px; padding: 0; place-items: center; color: var(--gm-text-secondary); background: transparent; border: 0; border-radius: 50%; cursor: pointer; }
.gm-web-icon-button:hover { color: var(--gm-text); background: var(--gm-surface-muted); }
.gm-web-locale select { min-width: 108px; padding: 6px 22px 6px 4px; color: var(--gm-text-secondary); appearance: auto; background: transparent; border: 0; cursor: pointer; }
.gm-web-content { display: grid; width: min(1120px, 100%); min-height: 0; margin: 0 auto; padding: clamp(48px, 9vh, 108px) var(--gm-space-6); align-items: center; gap: clamp(40px, 8vw, 112px); grid-template-columns: minmax(0, 1fr) minmax(320px, 0.82fr); }
.gm-web-content-copy { max-width: 520px; }
.gm-web-kicker { gap: var(--gm-space-2); color: var(--gm-primary); font-size: var(--gm-text-sm); font-weight: 600; }
h1 { max-width: 520px; margin: var(--gm-space-5) 0 var(--gm-space-4); color: var(--gm-text); font-size: clamp(32px, 4vw, 48px); font-weight: 700; letter-spacing: 0; line-height: 1.18; }
p { max-width: 480px; margin: 0 0 var(--gm-space-6); color: var(--gm-text-secondary); font-size: var(--gm-text-lg); line-height: 1.75; }
.gm-web-primary-button { display: inline-flex; min-height: 38px; padding: 0 var(--gm-space-3); align-items: center; gap: var(--gm-space-2); color: var(--gm-text-inverse); background: var(--gm-primary); border: 1px solid var(--gm-primary); border-radius: var(--gm-radius-md); cursor: pointer; font-weight: 600; }
.gm-web-primary-button:hover { background: var(--gm-primary-hover); border-color: var(--gm-primary-hover); }
.gm-web-document { min-height: 360px; padding: var(--gm-space-5); overflow: hidden; background: var(--gm-surface); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); box-shadow: var(--gm-shadow-md); }
.gm-web-document-tabs { display: flex; gap: 6px; margin-bottom: 44px; }
.gm-web-document-tabs span { width: 8px; height: 8px; background: var(--gm-border-strong); border-radius: 50%; }
.gm-web-document-tabs span:first-child { background: var(--gm-primary); }
.gm-web-document-title, .gm-web-document-line, .gm-web-document-code span { display: block; height: 10px; background: var(--gm-surface-muted); border-radius: var(--gm-radius-sm); }
.gm-web-document-title { width: 46%; height: 16px; margin-bottom: var(--gm-space-5); background: var(--gm-text); }
.gm-web-document-line { width: 87%; margin-bottom: var(--gm-space-3); }
.gm-web-document-line--long { width: 100%; }
.gm-web-document-line--short { width: 62%; }
.gm-web-document-code { display: grid; gap: 10px; margin-top: 44px; padding: var(--gm-space-4); background: var(--gm-canvas); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-md); }
.gm-web-document-code span:nth-child(1) { width: 74%; background: var(--gm-info); }
.gm-web-document-code span:nth-child(2) { width: 58%; background: var(--gm-primary); }
.gm-web-document-code span:nth-child(3) { width: 85%; }
.gm-web-document-code span:nth-child(4) { width: 42%; background: var(--gm-warning); }
@media (max-width: 760px) {
  .gm-web-menubar { padding: 0 var(--gm-space-3); }
  .gm-web-brand-tagline, .gm-web-brand-divider { display: none; }
  .gm-web-content { padding: 48px var(--gm-space-5); grid-template-columns: 1fr; }
  .gm-web-document { min-height: 280px; }
}
</style>
