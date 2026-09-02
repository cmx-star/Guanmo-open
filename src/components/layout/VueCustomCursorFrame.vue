<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'
import { useZustandSelector } from '@/composables/useZustandSelector'

const enabled = useZustandSelector(useSettingsStore, (state) => state.appearance.customCursorEnabled)
</script>

<template>
  <div class="h-full" :class="{ 'gm-vue-custom-cursor': enabled, 'gm-system-cursor': !enabled }">
    <slot />
  </div>
</template>

<style>
.gm-vue-custom-cursor,
.gm-vue-custom-cursor * {
  cursor: url('/cursor-icon.png') 4 0, default !important;
}

.gm-vue-custom-cursor input,
.gm-vue-custom-cursor textarea,
.gm-vue-custom-cursor [contenteditable='true'],
.gm-vue-custom-cursor .cm-editor,
.gm-vue-custom-cursor .cm-editor * {
  cursor: text !important;
}
</style>
