<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Send, Square } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import VueContextTagChip from '@/components/common/VueContextTagChip.vue'
import VueManualToolToggle from './VueManualToolToggle.vue'
import { useChatStore } from '@/stores/chatStore'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { addFileContextTag, addFolderContextTag } from '@/services/aiContext'

const props = defineProps<{ onSend: () => void; streaming: boolean; onCancel: () => void; resetManualToggle?: number }>()
const emit = defineEmits<{ reasoningModeChange: [mode: 'off' | 'on'] }>()
const { t } = useI18n()
const draftInput = useZustandSelector(useChatStore, (state) => state.draftInput)
const contextTags = useZustandSelector(useChatStore, (state) => state.contextTags)
const textarea = ref<HTMLTextAreaElement | null>(null)
const dragOver = ref(false)
let previousTagCount = contextTags.value.length
function resize(): void { const element = textarea.value; if (!element) return; element.style.height = 'auto'; element.style.height = `${Math.min(element.scrollHeight, 120)}px` }
function updateDraft(event: Event): void { useChatStore.getState().setDraftInput((event.target as HTMLTextAreaElement).value); resize() }
function keydown(event: KeyboardEvent): void { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); props.onSend() } }
function hasContextTransfer(event: DragEvent): boolean { return ['application/x-guanmo-file', 'application/x-guanmo-tab', 'application/x-guanmo-folder'].some((type) => event.dataTransfer?.types.includes(type)) }
function drop(event: DragEvent): void { event.preventDefault(); dragOver.value = false; const data = event.dataTransfer; if (!data) return; for (const [mime, handler] of [['application/x-guanmo-tab', (value: { title: string; filePath?: string }) => value.filePath && addFileContextTag({ title: value.title, filePath: value.filePath })], ['application/x-guanmo-file', (value: { name: string; path: string }) => addFileContextTag({ title: value.name, filePath: value.path })], ['application/x-guanmo-folder', (value: { name: string; path: string }) => addFolderContextTag({ title: value.name, folderPath: value.path })]] as const) { const raw = data.getData(mime); if (!raw) continue; try { handler(JSON.parse(raw)); } catch { /* Ignore malformed external transfer payloads. */ } return } }
watch(() => props.streaming, async (streaming) => { if (!streaming) { await nextTick(); textarea.value?.focus() } })
watch(contextTags, async (tags) => { if (tags.length > previousTagCount && !props.streaming) { await nextTick(); textarea.value?.focus() }; previousTagCount = tags.length })
watch(draftInput, (draft) => { if (!draft && textarea.value) textarea.value.style.height = '' })
</script>

<template>
  <div class="gm-vue-prompt-composer" :class="{ 'gm-vue-prompt-composer--dragging': dragOver }" @dragover="hasContextTransfer($event) && ($event.preventDefault(), dragOver = true)" @dragleave="dragOver = false" @drop="drop">
    <div v-if="dragOver" class="gm-vue-prompt-composer__drop">{{ t('aiComposer.dropContext') }}</div>
    <VueManualToolToggle :disabled="streaming" :reset-key="resetManualToggle" @reasoning-mode-change="emit('reasoningModeChange', $event)" />
    <div class="gm-vue-prompt-composer__input">
      <div v-if="contextTags.length" class="gm-vue-prompt-composer__tags"><VueContextTagChip v-for="tag in contextTags" :key="tag.id" :tag="tag" :on-remove="(id) => useChatStore.getState().removeContextTag(id)" /><button v-if="contextTags.length > 1" type="button" @click="useChatStore.getState().clearContextTags()">{{ t('aiComposer.clearContext') }}</button></div>
      <div class="gm-vue-prompt-composer__row"><textarea ref="textarea" :value="draftInput" :disabled="streaming" rows="1" :placeholder="t('aiComposer.placeholder')" @input="updateDraft" @keydown="keydown"></textarea><button v-if="streaming" type="button" class="gm-vue-prompt-composer__stop" :title="t('aiComposer.stop')" :aria-label="t('aiComposer.stop')" @click="onCancel"><Square :size="14" fill="currentColor" aria-hidden="true" /></button><button v-else type="button" class="gm-vue-prompt-composer__send" :disabled="!draftInput.trim() && !contextTags.length" :title="t('aiComposer.send')" :aria-label="t('aiComposer.send')" @click="onSend"><Send :size="16" aria-hidden="true" /></button></div>
    </div>
  </div>
</template>

<style scoped>
.gm-vue-prompt-composer { position: absolute; z-index: 20; right: 0; bottom: 0; left: 0; padding: 10px 12px 12px; border-top: 1px solid var(--gm-border); background: color-mix(in srgb, var(--gm-surface) 92%, transparent); backdrop-filter: blur(16px); }.gm-vue-prompt-composer--dragging { background: color-mix(in srgb, var(--gm-primary-subtle) 38%, var(--gm-surface)); }.gm-vue-prompt-composer__drop { margin-bottom: 6px; color: var(--gm-primary); font-size: var(--gm-text-xs); text-align: center; }.gm-vue-prompt-composer__input { border: 2px solid var(--gm-border); border-radius: var(--gm-radius-lg); background: var(--gm-surface-elevated); transition: border-color var(--gm-duration-fast); }.gm-vue-prompt-composer__input:focus-within { border-color: var(--gm-primary); }.gm-vue-prompt-composer__tags { display: flex; max-height: 80px; flex-wrap: wrap; gap: 4px; padding: 8px 10px 4px; overflow-y: auto; }.gm-vue-prompt-composer__tags > button { padding: 2px 4px; border: 0; color: var(--gm-text-tertiary); background: transparent; font-size: var(--gm-text-xs); cursor: pointer; }.gm-vue-prompt-composer__tags > button:hover { color: var(--gm-text); }.gm-vue-prompt-composer__row { display: flex; align-items: center; gap: 8px; padding: 7px; }.gm-vue-prompt-composer textarea { width: 100%; min-height: 22px; max-height: 120px; padding: 2px 3px; resize: none; border: 0; outline: none; color: var(--gm-text); background: transparent; line-height: 1.5; }.gm-vue-prompt-composer textarea:disabled { opacity: .6; }.gm-vue-prompt-composer__send, .gm-vue-prompt-composer__stop { display: grid; width: 32px; height: 32px; flex: 0 0 auto; padding: 0; place-items: center; border: 0; border-radius: var(--gm-radius-md); cursor: pointer; }.gm-vue-prompt-composer__send { color: var(--gm-text-on-primary); background: var(--gm-primary); }.gm-vue-prompt-composer__send:hover { background: var(--gm-primary-hover); }.gm-vue-prompt-composer__send:disabled { cursor: not-allowed; opacity: .45; }.gm-vue-prompt-composer__stop { color: var(--gm-error); background: color-mix(in srgb, var(--gm-error) 12%, transparent); }.gm-vue-prompt-composer__stop:hover { background: color-mix(in srgb, var(--gm-error) 20%, transparent); }
</style>
