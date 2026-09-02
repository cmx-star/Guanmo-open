<script setup lang="ts">
import {
  Copy,
  Globe2,
  Maximize,
  Minimize,
  Minus,
  MoonStar,
  Redo2,
  Square,
  SunMedium,
  Undo2,
  X,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{
  canUndo: boolean
  canRedo: boolean
  isFullscreen: boolean
  isMaximized: boolean
  isTauri: boolean
  isDark: boolean
  onUndo: () => void
  onRedo: () => void
  onToggleTheme: () => void
  onToggleFullscreen: () => void
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
}>()

const { locale, t } = useI18n()

function toggleLocale(): void {
  const nextLocale = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  locale.value = nextLocale
  document.documentElement.lang = nextLocale
  localStorage.setItem('guanmo-locale', nextLocale)
}
</script>

<template>
  <div class="gm-vue-titlebar">
    <div class="gm-vue-titlebar__brand">
      <span class="gm-vue-titlebar__mark" aria-hidden="true">观</span>
      <span class="gm-vue-titlebar__name">{{ t('app.name') }}</span>
      <span v-if="!isTauri" class="gm-vue-titlebar__browser-note">{{ t('desktop.browserNotice') }}</span>
    </div>

    <div class="gm-vue-titlebar__drag" data-tauri-drag-region=""></div>

    <div class="gm-vue-titlebar__actions">
      <button type="button" :disabled="!canUndo" :title="t('desktop.undo')" :aria-label="t('desktop.undo')" @click="onUndo">
        <Undo2 :size="15" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" :disabled="!canRedo" :title="t('desktop.redo')" :aria-label="t('desktop.redo')" @click="onRedo">
        <Redo2 :size="15" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" :title="isDark ? t('desktop.useLight') : t('desktop.useDark')" :aria-label="isDark ? t('desktop.useLight') : t('desktop.useDark')" @click="onToggleTheme">
        <SunMedium v-if="isDark" :size="15" stroke-width="1.8" aria-hidden="true" />
        <MoonStar v-else :size="15" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" :title="t('desktop.switchLanguage')" :aria-label="t('desktop.switchLanguage')" @click="toggleLocale">
        <Globe2 :size="15" stroke-width="1.8" aria-hidden="true" />
      </button>
      <span class="gm-vue-titlebar__divider" aria-hidden="true"></span>
      <button type="button" data-product-tour="fullscreen" :title="isFullscreen ? t('desktop.exitFullscreen') : t('desktop.enterFullscreen')" :aria-label="isFullscreen ? t('desktop.exitFullscreen') : t('desktop.enterFullscreen')" @click="onToggleFullscreen">
        <Minimize v-if="isFullscreen" :size="15" stroke-width="1.8" aria-hidden="true" />
        <Maximize v-else :size="15" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" :title="t('desktop.minimize')" :aria-label="t('desktop.minimize')" @click="onMinimize"><Minus :size="15" stroke-width="1.8" aria-hidden="true" /></button>
      <button type="button" :title="isMaximized ? t('desktop.restore') : t('desktop.maximize')" :aria-label="isMaximized ? t('desktop.restore') : t('desktop.maximize')" @click="onToggleMaximize">
        <Copy v-if="isMaximized" :size="14" stroke-width="1.8" aria-hidden="true" />
        <Square v-else :size="14" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" class="gm-vue-titlebar__close" :title="t('desktop.close')" :aria-label="t('desktop.close')" @click="onClose"><X :size="16" stroke-width="1.8" aria-hidden="true" /></button>
    </div>
  </div>
</template>

<style scoped>
.gm-vue-titlebar { display: flex; height: 38px; align-items: stretch; color: var(--gm-text); background: var(--gm-surface); border-bottom: 1px solid var(--gm-border-subtle); user-select: none; }
.gm-vue-titlebar__brand { display: flex; min-width: 0; padding: 0 12px; align-items: center; gap: 8px; }
.gm-vue-titlebar__mark { display: grid; width: 20px; height: 20px; place-items: center; color: var(--gm-text-inverse); background: var(--gm-primary); border-radius: 4px; font-size: 11px; font-weight: 700; }
.gm-vue-titlebar__name { font-size: 13px; font-weight: 700; }
.gm-vue-titlebar__browser-note { max-width: 300px; overflow: hidden; padding: 3px 6px; color: var(--gm-text-disabled); background: var(--gm-surface-elevated); border-radius: 4px; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.gm-vue-titlebar__drag { flex: 1; min-width: 20px; }
.gm-vue-titlebar__actions { display: flex; align-items: stretch; }
.gm-vue-titlebar__actions button { display: grid; width: 40px; padding: 0; place-items: center; color: var(--gm-text-secondary); background: transparent; border: 0; cursor: pointer; transition: background-color 120ms ease, color 120ms ease; }
.gm-vue-titlebar__actions button:hover:not(:disabled) { color: var(--gm-text); background: var(--gm-surface-hover); }
.gm-vue-titlebar__actions button:disabled { color: var(--gm-text-disabled); cursor: not-allowed; }
.gm-vue-titlebar__divider { width: 1px; height: 18px; margin: 0 4px; background: var(--gm-border-subtle); }
.gm-vue-titlebar__actions .gm-vue-titlebar__close { width: 48px; }
.gm-vue-titlebar__actions .gm-vue-titlebar__close:hover { color: white; background: var(--gm-error); }
</style>
