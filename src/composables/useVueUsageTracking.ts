import { onBeforeUnmount, watch, type Ref } from 'vue'
import { isTauri } from '@/hooks/useTauri'

export function useVueUsageTracking(ready: Ref<boolean>): void {
  let started = false
  let cancelled = false
  let trackingModule: Promise<typeof import('@/services/usageTracking')> | undefined

  const stop = watch(ready, (isReady) => {
    if (!isTauri() || !isReady || started) return
    started = true
    cancelled = false
    trackingModule = import('@/services/usageTracking')
    void trackingModule.then(({ startUsageTracking }) => {
      if (cancelled) return
      return startUsageTracking().catch(() => {
        started = false
        console.warn('[useVueUsageTracking] start failed')
      })
    })
  }, { immediate: true })

  onBeforeUnmount(() => {
    stop()
    cancelled = true
    if (!started) return
    started = false
    void trackingModule?.then(({ stopUsageTracking }) => stopUsageTracking().catch(() => {
      console.warn('[useVueUsageTracking] stop failed')
    }))
  })
}
