<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useZustandSelector } from '@/composables/useZustandSelector'
import { isTauri } from '@/hooks/useTauri'
import { toast } from '@/services/toast'
import {
  checkpointUsageTracking,
  clearUsageDataWithLifecycle,
  formatDuration,
  getHeatLevel,
  getLocalDateKey,
  getTwelveMonthRange,
  getUsageSnapshot,
  loadUsageActivity,
  queryUsageToday,
  queryUsageTotal,
  setUsageTrackingEnabled,
  subscribeUsageSnapshot,
  type UsageTrackingError,
} from '@/services/usageTracking'
import { useSettingsStore } from '@/stores/settingsStore'

interface HeatCell { date: string; level: 0 | 1 | 2 | 3 | 4; seconds: number; padding: boolean }
const { t } = useI18n()

const enabled = useZustandSelector(useSettingsStore, (state) => state.usageTracking.enabled)
const range = getTwelveMonthRange()
const todaySeconds = ref(0), totalSeconds = ref(0), activity = ref(new Map<string, number>())
const refreshBusy = ref(false), clearBusy = ref(false), confirmClear = ref(false)
const snapshot = ref(getUsageSnapshot())
let unsubscribe: (() => void) | undefined

const status = computed(() => {
  const error: UsageTrackingError | null = snapshot.value.error
  if (error?.kind === 'database_write') return t('usage.saveFailed')
  if (error?.kind === 'database_read') return t('usage.loadFailed')
  if (error?.kind === 'window_state') return t('usage.windowStateUnavailable')
  if (error?.kind === 'startup') return t('usage.startupFailed')
  if (!enabled.value) return t('usage.disabled')
  return snapshot.value.isActive ? t('usage.active') : t('usage.inactive')
})

const cells = computed<HeatCell[]>(() => {
  const start = new Date(`${range.start}T00:00:00`), end = new Date(`${range.end}T00:00:00`)
  const dates: string[] = []
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) dates.push(getLocalDateKey(cursor))
  const before = start.getDay() === 0 ? 6 : start.getDay() - 1
  const padded = [...Array<string>(before).fill(''), ...dates]
  const size = Math.ceil(padded.length / 7) * 7
  return Array.from({ length: size }, (_, index) => {
    const date = padded[index] ?? ''
    const seconds = activity.value.get(date) ?? 0
    return { date, seconds, level: getHeatLevel(Math.floor(seconds / 60)), padding: !date }
  })
})

async function refresh(): Promise<void> {
  const [today, total, data] = await Promise.all([queryUsageToday(), queryUsageTotal(), loadUsageActivity(range.start, range.end)])
  todaySeconds.value = today
  totalSeconds.value = total
  activity.value = data
  snapshot.value = getUsageSnapshot()
}

async function handleRefresh(): Promise<void> {
  refreshBusy.value = true
  try { await checkpointUsageTracking(); await refresh() } catch { toast.error(t('usage.refreshFailed')) } finally { refreshBusy.value = false }
}
async function toggle(value: boolean): Promise<void> {
  try { await setUsageTrackingEnabled(value) } catch { toast.error(t('usage.toggleFailed')) }
}
async function clear(): Promise<void> {
  clearBusy.value = true
  try { await clearUsageDataWithLifecycle(); confirmClear.value = false; await refresh(); toast.success(t('usage.cleared')) } catch { toast.error(t('usage.clearFailed')) } finally { clearBusy.value = false }
}
function label(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return `${year}/${month}/${day}`
}

onMounted(() => {
  void refresh().catch(() => { snapshot.value = getUsageSnapshot() })
  unsubscribe = subscribeUsageSnapshot((next) => { snapshot.value = next; void refresh().catch(() => undefined) })
})
onBeforeUnmount(() => unsubscribe?.())
</script>

<template>
  <section v-if="isTauri()" class="gm-vue-usage">
    <div class="gm-vue-usage__header"><div><h3>{{ t('usage.title') }}</h3><p :data-error="snapshot.error ? 'true' : undefined">{{ status }}</p></div><div class="gm-vue-settings-actions"><button type="button" :disabled="refreshBusy" @click="handleRefresh">{{ refreshBusy ? t('usage.refreshing') : t('usage.refresh') }}</button><button type="button" class="gm-vue-settings-danger" @click="confirmClear = true">{{ t('usage.clearData') }}</button><label class="gm-vue-usage__toggle">{{ t('usage.record') }}<input type="checkbox" :checked="enabled" @change="toggle(($event.target as HTMLInputElement).checked)" /></label></div></div>
    <div class="gm-vue-usage__stats"><div><small>{{ t('usage.totalDuration') }}</small><b>{{ formatDuration(totalSeconds) }}</b></div><div><small>{{ t('usage.todayDuration') }}</small><b>{{ formatDuration(todaySeconds) }}</b></div></div>
    <div class="gm-vue-usage__activity"><h4>{{ t('usage.activity') }}</h4><div class="gm-vue-usage__heatmap" role="grid" :aria-label="t('usage.activityLabel')"><span v-for="(cell, index) in cells" :key="index" :class="['gm-vue-usage__cell', { 'is-padding': cell.padding }]" :data-level="cell.padding ? undefined : cell.level" :title="cell.padding ? undefined : `${label(cell.date)} · ${formatDuration(cell.seconds)}`" /></div></div>
    <div v-if="confirmClear" class="gm-vue-usage__scrim" @mousedown.self="!clearBusy && (confirmClear = false)"><section role="dialog" aria-modal="true"><h4>{{ t('usage.clearTitle') }}</h4><p>{{ t('usage.clearDescription') }}</p><footer><button type="button" :disabled="clearBusy" @click="confirmClear = false">{{ t('usage.cancel') }}</button><button type="button" class="gm-vue-settings-danger" :disabled="clearBusy" @click="clear">{{ clearBusy ? t('usage.clearing') : t('usage.clear') }}</button></footer></section></div>
  </section>
</template>

<style scoped>
.gm-vue-usage { display: grid; gap: 12px; padding: 10px 0; }.gm-vue-usage__header { display: flex; align-items: start; justify-content: space-between; gap: 12px; }.gm-vue-usage h3,.gm-vue-usage h4 { margin: 0; color: var(--gm-text); font-size: var(--gm-text-sm); }.gm-vue-usage h4 { color: var(--gm-text-secondary); }.gm-vue-usage__header p { margin: 4px 0 0; color: var(--gm-success); font-size: var(--gm-text-xs); }.gm-vue-usage__header p[data-error='true'] { color: var(--gm-error); }.gm-vue-usage__toggle { display: inline-flex; align-items: center; gap: 6px; color: var(--gm-text-secondary); font-size: var(--gm-text-xs); }.gm-vue-usage__toggle input { width: 16px; height: 16px; accent-color: var(--gm-primary); }.gm-vue-usage__stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }.gm-vue-usage__stats > div,.gm-vue-usage__activity { padding: 10px; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-sm); background: var(--gm-surface-elevated); }.gm-vue-usage__stats small { display: block; color: var(--gm-text-tertiary); font-size: var(--gm-text-xs); }.gm-vue-usage__stats b { display: block; margin-top: 4px; color: var(--gm-text); font-size: var(--gm-text-sm); }.gm-vue-usage__heatmap { display: grid; grid-template-columns: repeat(53, minmax(0, 1fr)); gap: 3px; margin-top: 10px; }.gm-vue-usage__cell { min-width: 4px; aspect-ratio: 1; border-radius: 2px; background: var(--gm-surface-muted); }.gm-vue-usage__cell[data-level='1'] { background: color-mix(in srgb, var(--gm-primary) 28%, var(--gm-surface-muted)); }.gm-vue-usage__cell[data-level='2'] { background: color-mix(in srgb, var(--gm-primary) 48%, var(--gm-surface-muted)); }.gm-vue-usage__cell[data-level='3'] { background: color-mix(in srgb, var(--gm-primary) 72%, var(--gm-surface-muted)); }.gm-vue-usage__cell[data-level='4'] { background: var(--gm-primary); }.gm-vue-usage__cell.is-padding { visibility: hidden; }.gm-vue-usage__scrim { position: fixed; z-index: 1200; inset: 0; display: grid; padding: 20px; place-items: center; background: rgb(0 0 0 / 45%); }.gm-vue-usage__scrim section { width: min(100%, 380px); padding: 18px; color: var(--gm-text); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); background: var(--gm-surface); box-shadow: var(--gm-shadow-lg); }.gm-vue-usage__scrim p { color: var(--gm-text-secondary); font-size: var(--gm-text-sm); line-height: 1.55; }.gm-vue-usage__scrim footer { display: flex; justify-content: end; gap: 8px; }.gm-vue-usage__scrim button { padding: 6px 10px; color: var(--gm-text-secondary); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-sm); background: var(--gm-surface); }
</style>
