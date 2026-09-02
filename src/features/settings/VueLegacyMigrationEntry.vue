<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { detectLegacyData, getLegacyIndexedDBPath, getSqliteDatabasePath, type LegacyDetectionResult } from '@/services/database/legacyDetector'
import { toast } from '@/services/toast'

const { t } = useI18n()
const result = ref<LegacyDetectionResult | null>(null)
const loading = ref(false)
async function detect(): Promise<void> {
  loading.value = true
  try { result.value = await detectLegacyData() } catch { toast.error(t('legacyMigrationEntry.detectFailed')) } finally { loading.value = false }
}
async function openTool(): Promise<void> {
  const url = 'https://github.com/we-used-to-be/Guanmo-open/releases/tag/v1.0.0-migration-tool'
  try { const { open } = await import('@tauri-apps/plugin-shell'); await open(url) } catch { window.open(url, '_blank', 'noopener,noreferrer') }
}
</script>

<template>
  <section class="gm-vue-legacy-entry"><div class="gm-vue-settings-row"><span><b>{{ t('legacyMigrationEntry.title') }}</b><small>{{ t('legacyMigrationEntry.description') }}</small></span><button type="button" :disabled="loading" @click="detect">{{ loading ? t('legacyMigrationEntry.detecting') : t('legacyMigrationEntry.detect') }}</button></div><div v-if="result" class="gm-vue-settings-notice"><p v-if="!result.legacyDetected">{{ t('legacyMigrationEntry.noneFound') }}</p><template v-else><p>{{ t('legacyMigrationEntry.found') }}</p><dl><dt>{{ t('legacy.sqlite') }}</dt><dd><code>{{ getSqliteDatabasePath() }}</code></dd><dt>{{ t('legacy.indexedDb') }}</dt><dd><code>{{ getLegacyIndexedDBPath() }}</code></dd></dl><button type="button" class="gm-vue-settings-primary" @click="openTool">{{ t('legacyMigrationEntry.downloadTool') }}</button></template></div></section>
</template>

<style scoped>
.gm-vue-legacy-entry { display: grid; gap: 8px; }.gm-vue-legacy-entry p { margin: 0; }.gm-vue-legacy-entry dl { display: grid; gap: 4px; margin: 10px 0; }.gm-vue-legacy-entry dt { color: var(--gm-text-tertiary); font-size: var(--gm-text-xs); }.gm-vue-legacy-entry dd { margin: 0; }.gm-vue-legacy-entry code { display: block; padding: 5px 7px; overflow-wrap: anywhere; color: var(--gm-text-secondary); background: var(--gm-canvas); border-radius: var(--gm-radius-sm); }
</style>
