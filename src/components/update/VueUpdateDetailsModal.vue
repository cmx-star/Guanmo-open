<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import VueAssistantMarkdown from '@/components/ai/VueAssistantMarkdown.vue'
import { toast } from '@/services/toast'
import { GITHUB_REPOSITORY_URL, LATEST_RELEASE_PAGE_URL, openReleaseInSystemBrowser } from '@/services/updateService'
import { useUpdateStore } from '@/stores/updateStore'
import { useZustandSelector } from '@/composables/useZustandSelector'

const { t } = useI18n()
const details = useZustandSelector(useUpdateStore, (state) => state.selectedRelease)
const closeButton = ref<HTMLButtonElement | null>(null)
const closing = ref(false)
let closeTimer: number | undefined

const publishedAt = computed(() => {
  const value = details.value?.release.published_at
  if (!value) return ''
  return Number.isNaN(Date.parse(value)) ? value : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
})
const currentRelease = computed(() => details.value?.mode === 'current')
const subtitle = computed(() => !details.value ? '' : currentRelease.value ? t('updateDetails.releasedAt', { date: publishedAt.value }) : t('updateDetails.currentVersion', { version: details.value.currentVersion, date: publishedAt.value }))
const notes = computed(() => details.value?.release.body?.trim() || t('updateDetails.noNotes'))

function close(): void { useUpdateStore.getState().closeDetails() }
function requestClose(): void {
  if (closing.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { close(); return }
  closing.value = true
  closeTimer = window.setTimeout(close, 160)
}
function openPage(url: string, fallback: string): void { void openReleaseInSystemBrowser(url).catch((error) => toast.error(error instanceof Error ? error.message : fallback)) }
function onKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') requestClose() }

watch(details, async (value) => {
  if (!value) { closing.value = false; return }
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  closeButton.value?.focus()
}, { immediate: true })

onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); if (closeTimer) window.clearTimeout(closeTimer) })
</script>

<template>
  <div v-if="details" class="gm-vue-release-scrim" :data-closing="closing || undefined" @mousedown.self="requestClose">
    <section class="gm-vue-release-dialog" role="dialog" aria-modal="true" aria-labelledby="update-details-title">
      <header><div><div class="gm-vue-release-title"><h2 id="update-details-title">{{ currentRelease ? t('updateDetails.versionOverview') : t('updateDetails.newVersion') }}</h2><span>v{{ details.releaseVersion }}</span></div><p>{{ subtitle }}</p></div><button ref="closeButton" type="button" :aria-label="t('updateDetails.close')" :title="t('updateDetails.close')" @click="requestClose"><X :size="17" aria-hidden="true" /></button></header>
      <main><h3>{{ t('updateDetails.releaseNotes') }}</h3><VueAssistantMarkdown :content="notes" /></main>
      <footer><button type="button" @click="openPage(GITHUB_REPOSITORY_URL, t('updateDetails.openRepoFailed'))">{{ t('updateDetails.starRepo') }}</button><button type="button" class="gm-vue-release-primary" @click="openPage(LATEST_RELEASE_PAGE_URL, t('updateDetails.openDownloadFailed'))">{{ t('updateDetails.download') }}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.gm-vue-release-scrim { position: fixed; z-index: 1050; inset: 0; display: grid; padding: 20px; place-items: center; background: rgb(0 0 0 / 45%); }.gm-vue-release-dialog { display: flex; width: min(100%, 680px); max-height: 82vh; flex-direction: column; overflow: hidden; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); background: var(--gm-surface); box-shadow: var(--gm-shadow-lg); }.gm-vue-release-scrim[data-closing='true'] { animation: gm-release-out .16s ease forwards; }.gm-vue-release-dialog header { display: flex; padding: 16px 20px; align-items: start; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--gm-border); }.gm-vue-release-title { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }.gm-vue-release-title h2,.gm-vue-release-dialog h3 { margin: 0; color: var(--gm-text); font-size: var(--gm-text-lg); }.gm-vue-release-title span { padding: 2px 8px; border-radius: var(--gm-radius-sm); color: var(--gm-primary); background: var(--gm-primary-subtle); font-size: var(--gm-text-xs); font-weight: 700; }.gm-vue-release-dialog header p { margin: 5px 0 0; color: var(--gm-text-tertiary); font-size: var(--gm-text-sm); }.gm-vue-release-dialog header button { display: grid; width: 32px; height: 32px; flex: 0 0 auto; place-items: center; color: var(--gm-text-tertiary); border: 0; border-radius: var(--gm-radius-sm); background: transparent; }.gm-vue-release-dialog header button:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-vue-release-dialog main { min-height: 0; padding: 18px 20px; overflow-y: auto; }.gm-vue-release-dialog main h3 { margin-bottom: 12px; font-size: var(--gm-text-base); }.gm-vue-release-dialog footer { display: flex; flex-wrap: wrap; padding: 14px 20px; justify-content: end; gap: 8px; border-top: 1px solid var(--gm-border); }.gm-vue-release-dialog footer button { padding: 7px 12px; color: var(--gm-text); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-sm); background: var(--gm-surface); font-size: var(--gm-text-sm); }.gm-vue-release-dialog footer button:hover { background: var(--gm-surface-hover); }.gm-vue-release-dialog footer .gm-vue-release-primary { color: var(--gm-text-on-primary); border-color: var(--gm-primary); background: var(--gm-primary); }.gm-vue-release-dialog footer .gm-vue-release-primary:hover { background: var(--gm-primary-hover); }@keyframes gm-release-out { to { opacity: 0; } }
</style>
