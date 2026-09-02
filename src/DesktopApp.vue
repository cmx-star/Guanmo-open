<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VueGlobalTooltip from './components/common/VueGlobalTooltip.vue'
import VueToastContainer from './components/common/VueToastContainer.vue'
import VueLegacyDataNoticeModal from './components/legacy/VueLegacyDataNoticeModal.vue'
import VueAppLayout from './components/layout/VueAppLayout.vue'
import VueCustomCursorFrame from './components/layout/VueCustomCursorFrame.vue'
import VueUpdateManager from './components/update/VueUpdateManager.vue'
import VuePerfMonitorPanel from './components/devtools/VuePerfMonitorPanel.vue'
import { useVueExternalFileOpen } from './composables/useVueExternalFileOpen'
import { useVueUsageTracking } from './composables/useVueUsageTracking'
import { requestProductTour } from './features/productTour/productTourEvents'
import { hasShownProductTourInvite, markProductTourInviteShown } from './features/productTour/productTourStorage'
import { isTauri } from './hooks/useTauri'
import type { LegacyDetectionResult } from './services/database/legacyDetector'
import {
  initializeApplication,
  scheduleIdleWarmup,
  showDatabaseInitFailure,
  startReadingReminderRuntime,
} from './services/appStartup'
import { eventMarker } from './services/eventMarker'
import { markStartupPoint, waitForStartupPoint } from './services/startupPerformance'
import { toast } from './services/toast'
import { syncDocumentTheme, useSettingsStore } from './stores/settingsStore'
const showPerfMonitor = import.meta.env.DEV

const appReady = ref(false)
const legacyDetection = ref<LegacyDetectionResult | null>(null)
const { t } = useI18n()
let unsubscribeTheme: (() => void) | undefined
let stopReadingReminderRuntime: (() => void) | undefined

function blockNativeContextMenu(event: MouseEvent): void {
  event.preventDefault()
}

useVueExternalFileOpen(appReady)
useVueUsageTracking(appReady)

watch(appReady, (ready) => {
  if (!ready || !isTauri() || hasShownProductTourInvite()) return
  markProductTourInviteShown()
  toast.show({
    id: 'product-tour-invite',
    title: t('desktopApp.tourTitle'),
    message: t('desktopApp.tourMessage'),
    type: 'info',
    duration: null,
    actions: [{ label: t('desktopApp.startTour'), primary: true, onClick: requestProductTour }],
  })
})

onMounted(() => {
  syncDocumentTheme(useSettingsStore.getState().appearance.themeId)
  unsubscribeTheme = useSettingsStore.subscribe((state) => {
    syncDocumentTheme(state.appearance.themeId)
  })

  document.addEventListener('contextmenu', blockNativeContextMenu)

  ;(window as unknown as Record<string, unknown>).__testLegacyModal = () => {
    legacyDetection.value = {
      legacyDetected: true,
      userNoticed: false,
      detectedAt: Date.now(),
      noticedAt: null,
      detectedCounts: { documents: 3, chat_sessions: 5, chat_messages: 42, memories: 12 },
    }
  }

  void (async () => {
    try {
      await waitForStartupPoint('app-shell-interactive')
      await initializeApplication()
      appReady.value = true
      eventMarker.mark('app-ready')
      markStartupPoint('app-ready')
      stopReadingReminderRuntime = await startReadingReminderRuntime()
      scheduleIdleWarmup()
    } catch (error) {
      showDatabaseInitFailure(error)
    }
  })()
})

onBeforeUnmount(() => {
  unsubscribeTheme?.()
  stopReadingReminderRuntime?.()
  document.removeEventListener('contextmenu', blockNativeContextMenu)
  delete (window as unknown as Record<string, unknown>).__testLegacyModal
})
</script>

<template>
  <VueCustomCursorFrame>
    <VueAppLayout />
  </VueCustomCursorFrame>
  <VueUpdateManager />
  <VuePerfMonitorPanel v-if="showPerfMonitor" />
  <VueToastContainer />
  <VueGlobalTooltip />
  <VueLegacyDataNoticeModal v-if="legacyDetection" :detection="legacyDetection" :on-close="() => legacyDetection = null" />
</template>
