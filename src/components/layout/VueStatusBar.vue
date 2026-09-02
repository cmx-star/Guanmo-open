<script setup lang="ts">
import { BotMessageSquare, FileText } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  filePath: string | null
  fileTitle: string | null
  modified: boolean
  wordCount: number
  aiStatus: string
  aiStatusLabel: string
  onToggleAssistant: () => void
}>()

const { t } = useI18n()
</script>

<template>
  <footer class="gm-vue-statusbar">
    <span class="gm-vue-statusbar__file">
      <FileText :size="13" stroke-width="1.8" aria-hidden="true" />
      <span>{{ filePath ? fileTitle : t('desktop.noOpenFile') }}</span>
    </span>
    <span class="gm-vue-statusbar__spacer"></span>
    <template v-if="fileTitle">
      <span>{{ t('desktop.encoding') }}</span>
      <span>{{ wordCount }} {{ t('desktop.words') }}</span>
      <span v-if="modified" class="gm-vue-statusbar__modified">{{ t('desktop.modified') }}</span>
      <span class="gm-vue-statusbar__separator" aria-hidden="true"></span>
    </template>
    <button type="button" data-product-tour="ai-assistant" :title="t('desktop.toggleAssistant')" @click="props.onToggleAssistant">
      <i :class="`gm-vue-statusbar__indicator gm-vue-statusbar__indicator--${aiStatus}`" aria-hidden="true"></i>
      <BotMessageSquare :size="13" stroke-width="1.8" aria-hidden="true" />
      <span>{{ t(aiStatusLabel) }}</span>
    </button>
  </footer>
</template>

<style scoped>
.gm-vue-statusbar { display: flex; height: 32px; min-width: 0; padding: 0 14px; align-items: center; gap: 14px; color: var(--gm-text-secondary); background: var(--gm-surface); border-top: 1px solid var(--gm-border-subtle); font-size: 12px; }
.gm-vue-statusbar span { display: inline-flex; min-width: 0; align-items: center; gap: 5px; }
.gm-vue-statusbar__file { overflow: hidden; }
.gm-vue-statusbar__file > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gm-vue-statusbar__spacer { flex: 1; }
.gm-vue-statusbar__separator { width: 1px; height: 14px; background: var(--gm-border-subtle); }
.gm-vue-statusbar__modified { color: var(--gm-primary); font-weight: 700; }
.gm-vue-statusbar button { display: inline-flex; height: 24px; padding: 0 5px; align-items: center; gap: 5px; color: var(--gm-text-secondary); background: transparent; border: 0; border-radius: 4px; cursor: pointer; }
.gm-vue-statusbar button:hover { color: var(--gm-text); background: var(--gm-surface-hover); }
.gm-vue-statusbar__indicator { width: 7px; height: 7px; border-radius: 50%; background: var(--gm-text-disabled); }
.gm-vue-statusbar__indicator--ok { background: var(--gm-success); }
.gm-vue-statusbar__indicator--chat_unreachable, .gm-vue-statusbar__indicator--embedding_unreachable, .gm-vue-statusbar__indicator--both_unreachable, .gm-vue-statusbar__indicator--search_unreachable, .gm-vue-statusbar__indicator--chat_search_unreachable, .gm-vue-statusbar__indicator--embedding_search_unreachable, .gm-vue-statusbar__indicator--all_unreachable { background: var(--gm-error); }
</style>
