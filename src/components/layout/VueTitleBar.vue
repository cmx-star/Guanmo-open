<script setup lang="ts">
import {
  FilePlus2,
  FolderOpen,
  FolderPlus,
  Languages,
  Maximize2,
  Minimize2,
  MoonStar,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  Search,
  Settings2,
  SunMedium,
  Undo2,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{
  canUndo: boolean
  canRedo: boolean
  isFullscreen: boolean
  isTauri: boolean
  isDark: boolean
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onNewFile: () => void
  onOpenFile: () => void
  onOpenFolder: () => void
  onOpenSearch: () => void
  onOpenSettings: () => void
  onUndo: () => void
  onRedo: () => void
  onToggleTheme: () => void
  onToggleFullscreen: () => void
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
  <header class="gm-vue-toolbar">
    <div class="gm-vue-toolbar__group">
      <button
        type="button"
        class="gm-vue-toolbar__button"
        data-product-tour="sidebar-toggle"
        :title="sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')"
        :aria-label="sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')"
        @click="onToggleSidebar"
      >
        <PanelLeftOpen v-if="sidebarCollapsed" :size="17" stroke-width="1.8" aria-hidden="true" />
        <PanelLeftClose v-else :size="17" stroke-width="1.8" aria-hidden="true" />
      </button>
      <span class="gm-vue-toolbar__divider" aria-hidden="true"></span>
      <button type="button" class="gm-vue-toolbar__button" :title="t('desktop.newFile')" :aria-label="t('desktop.newFile')" @click="onNewFile">
        <FilePlus2 :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" class="gm-vue-toolbar__button" data-product-tour="open-file" :title="t('desktop.openFile')" :aria-label="t('desktop.openFile')" @click="onOpenFile">
        <FolderOpen :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" class="gm-vue-toolbar__button" data-product-tour="open-folder" :title="t('sidebar.openFolder')" :aria-label="t('sidebar.openFolder')" @click="onOpenFolder">
        <FolderPlus :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" class="gm-vue-toolbar__button" :title="t('common.search')" :aria-label="t('common.search')" @click="onOpenSearch">
        <Search :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
      <span v-if="!isTauri" class="gm-vue-toolbar__browser-note">{{ t('desktop.browserNotice') }}</span>
    </div>

    <div class="gm-vue-toolbar__spacer" aria-hidden="true"></div>

    <div class="gm-vue-toolbar__group">
      <button type="button" class="gm-vue-toolbar__button" :disabled="!canUndo" :title="t('desktop.undo')" :aria-label="t('desktop.undo')" @click="onUndo">
        <Undo2 :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" class="gm-vue-toolbar__button" :disabled="!canRedo" :title="t('desktop.redo')" :aria-label="t('desktop.redo')" @click="onRedo">
        <Redo2 :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
      <span class="gm-vue-toolbar__divider" aria-hidden="true"></span>
      <button type="button" class="gm-vue-toolbar__button" :title="isDark ? t('desktop.useLight') : t('desktop.useDark')" :aria-label="isDark ? t('desktop.useLight') : t('desktop.useDark')" @click="onToggleTheme">
        <SunMedium v-if="isDark" :size="16" stroke-width="1.8" aria-hidden="true" />
        <MoonStar v-else :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
      <button type="button" class="gm-vue-toolbar__button" :title="t('desktop.switchLanguage')" :aria-label="t('desktop.switchLanguage')" @click="toggleLocale">
        <Languages :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
      <span class="gm-vue-toolbar__divider" aria-hidden="true"></span>
      <button type="button" class="gm-vue-toolbar__button" data-product-tour="fullscreen" :title="isFullscreen ? t('desktop.exitFullscreen') : t('desktop.enterFullscreen')" :aria-label="isFullscreen ? t('desktop.exitFullscreen') : t('desktop.enterFullscreen')" @click="onToggleFullscreen">
        <Minimize2 v-if="isFullscreen" :size="16" stroke-width="1.8" aria-hidden="true" />
        <Maximize2 v-else :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
      <span class="gm-vue-toolbar__divider" aria-hidden="true"></span>
      <button type="button" class="gm-vue-toolbar__button" data-product-tour="settings" :title="t('common.settings')" :aria-label="t('common.settings')" @click="onOpenSettings">
        <Settings2 :size="16" stroke-width="1.8" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.gm-vue-toolbar { display: flex; height: 44px; flex: 0 0 auto; align-items: center; gap: 8px; padding: 0 10px; color: var(--gm-text); background: var(--gm-surface); border-bottom: 1px solid var(--gm-border-subtle); user-select: none; }
.gm-vue-toolbar__group { display: flex; min-width: 0; align-items: center; gap: 2px; }
.gm-vue-toolbar__spacer { flex: 1; }
.gm-vue-toolbar__button { display: grid; width: 30px; height: 30px; flex: 0 0 auto; padding: 0; place-items: center; color: var(--gm-text-secondary); background: transparent; border: 0; border-radius: var(--gm-radius-sm); cursor: pointer; transition: background-color 120ms ease, color 120ms ease; }
.gm-vue-toolbar__button:hover:not(:disabled) { color: var(--gm-text); background: var(--gm-surface-hover); }
.gm-vue-toolbar__button:active:not(:disabled) { background: var(--gm-primary-subtle); color: var(--gm-primary); }
.gm-vue-toolbar__button:disabled { color: var(--gm-text-disabled); cursor: not-allowed; }
.gm-vue-toolbar__button:focus-visible { outline: 2px solid var(--gm-border-focus); outline-offset: 1px; }
.gm-vue-toolbar__divider { width: 1px; height: 16px; flex: 0 0 auto; margin: 0 6px; background: var(--gm-border-subtle); }
.gm-vue-toolbar__browser-note { overflow: hidden; max-width: 300px; padding: 3px 8px; color: var(--gm-text-tertiary); background: var(--gm-surface-elevated); border-radius: 999px; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
</style>
