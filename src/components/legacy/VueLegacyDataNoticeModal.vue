<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getLegacyIndexedDBPath,
  getSqliteDatabasePath,
  markLegacyDetected,
  type LegacyDetectionResult,
} from '@/services/database/legacyDetector'

const props = defineProps<{
  detection: LegacyDetectionResult
  onClose: () => void
}>()

const { t } = useI18n()
const closing = ref(false)
let closeTimer: number | undefined

async function requestClose(): Promise<void> {
  if (closing.value) return
  try {
    await markLegacyDetected()
  } catch {
    // The user can still close this non-destructive notice when persistence fails.
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    props.onClose()
    return
  }

  closing.value = true
  closeTimer = window.setTimeout(props.onClose, 160)
}

async function openMigrationTool(): Promise<void> {
  const url = 'https://github.com/we-used-to-be/Guanmo-open/releases/tag/v1.0.0-migration-tool'
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

onBeforeUnmount(() => {
  if (closeTimer) window.clearTimeout(closeTimer)
})
</script>

<template>
  <div
    class="gm-vue-legacy-scrim"
    :data-closing="closing || undefined"
    role="dialog"
    aria-modal="true"
    aria-labelledby="legacy-notice-title"
  >
    <section class="gm-vue-legacy-dialog">
      <header>
        <h2 id="legacy-notice-title">{{ t('legacy.title') }}</h2>
        <p>{{ t('legacy.description') }}</p>
      </header>

      <div class="gm-vue-legacy-paths">
        <div>
          <p>{{ t('legacy.sqlite') }}</p>
          <code>{{ getSqliteDatabasePath() }}</code>
        </div>
        <div>
          <p>{{ t('legacy.indexedDb') }}</p>
          <code>{{ getLegacyIndexedDBPath() }}</code>
        </div>
      </div>

      <div class="gm-vue-legacy-primary-action">
        <button type="button" @click="openMigrationTool">{{ t('legacy.downloadTool') }}</button>
      </div>
      <footer>
        <button type="button" @click="requestClose">{{ t('legacy.acknowledge') }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.gm-vue-legacy-scrim { position: fixed; z-index: 1100; inset: 0; display: grid; padding: 20px; place-items: center; background: rgb(0 0 0 / 45%); }.gm-vue-legacy-dialog { width: min(100%, 448px); overflow: hidden; color: var(--gm-text); background: var(--gm-surface); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); box-shadow: var(--gm-shadow-md); }.gm-vue-legacy-dialog header { padding: 20px; border-bottom: 1px solid var(--gm-border); }.gm-vue-legacy-dialog h2 { margin: 0; font-size: 18px; line-height: 1.35; }.gm-vue-legacy-dialog header p { margin: 8px 0 0; color: var(--gm-text-secondary); font-size: 13px; line-height: 1.65; white-space: pre-line; }.gm-vue-legacy-paths { display: grid; gap: 12px; padding: 20px; }.gm-vue-legacy-paths p { margin: 0 0 4px; color: var(--gm-text-tertiary); font-size: 11px; font-weight: 700; text-transform: uppercase; }.gm-vue-legacy-paths code { display: block; padding: 6px 8px; overflow-wrap: anywhere; color: var(--gm-text-secondary); background: var(--gm-surface-elevated); border-radius: var(--gm-radius-sm); font-size: 12px; }.gm-vue-legacy-primary-action { padding: 0 20px 20px; }.gm-vue-legacy-primary-action button { width: 100%; min-height: 36px; color: var(--gm-text-on-primary); background: var(--gm-primary); border: 1px solid var(--gm-primary); border-radius: var(--gm-radius-md); cursor: pointer; font-weight: 700; }.gm-vue-legacy-primary-action button:hover { background: var(--gm-primary-hover); border-color: var(--gm-primary-hover); }.gm-vue-legacy-dialog footer { display: grid; padding: 10px 20px; border-top: 1px solid var(--gm-border); }.gm-vue-legacy-dialog footer button { width: 100%; min-height: 32px; color: var(--gm-text-secondary); background: transparent; border: 0; border-radius: var(--gm-radius-md); cursor: pointer; }.gm-vue-legacy-dialog footer button:hover { color: var(--gm-text); background: var(--gm-surface-hover); }
</style>
