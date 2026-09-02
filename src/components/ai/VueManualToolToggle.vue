<script setup lang="ts">
import { watch, ref } from 'vue'
import { Brain } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ disabled?: boolean; resetKey?: number }>(), { disabled: false, resetKey: undefined })
const emit = defineEmits<{ reasoningModeChange: [mode: 'off' | 'on'] }>()
const reasoningMode = ref<'off' | 'on'>('off')
function toggle(): void { if (!props.disabled) { reasoningMode.value = reasoningMode.value === 'off' ? 'on' : 'off'; emit('reasoningModeChange', reasoningMode.value) } }
watch(() => props.resetKey, () => { reasoningMode.value = 'off' })
</script>

<template>
  <div class="gm-vue-tool-toggle"><button type="button" :disabled="disabled" :data-active="reasoningMode === 'on'" :title="reasoningMode === 'on' ? 'Deep reasoning is enabled for this request' : 'Use deeper reasoning for this request'" @click="toggle"><Brain :size="14" aria-hidden="true" /><span>{{ reasoningMode === 'on' ? 'Deep reasoning' : 'Reasoning' }}</span></button></div>
</template>

<style scoped>
.gm-vue-tool-toggle { padding: 2px 8px 5px; }.gm-vue-tool-toggle button { display: inline-flex; height: 28px; align-items: center; gap: 5px; padding: 0 9px; border: 1px solid var(--gm-border); border-radius: 999px; color: var(--gm-text-secondary); background: var(--gm-surface); font-size: var(--gm-text-xs); font-weight: 600; cursor: pointer; }.gm-vue-tool-toggle button:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-tool-toggle button[data-active='true'] { border-color: var(--gm-primary); color: var(--gm-primary); background: var(--gm-primary-subtle); }.gm-vue-tool-toggle button:disabled { cursor: not-allowed; opacity: .55; }
</style>
