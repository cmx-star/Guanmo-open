<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { isTauri } from '@/hooks/useTauri'
import { runAutomaticUpdateCheck } from '@/services/updateNotifications'
import type { UpdateCheckResult } from '@/services/updateService'
import VueUpdateDetailsModal from './VueUpdateDetailsModal.vue'

const STARTUP_CHECK_DELAY_MS = 7_000
let timer: number | undefined
let triggerAutomaticUpdateCheck: (() => Promise<UpdateCheckResult>) | undefined

declare global {
  interface Window {
    guanmoDev?: { triggerAutomaticUpdateCheck: () => Promise<UpdateCheckResult> }
  }
}

onMounted(() => {
  if (!isTauri()) return
  timer = window.setTimeout(() => { void runAutomaticUpdateCheck().catch(() => {}) }, STARTUP_CHECK_DELAY_MS)
  if (import.meta.env.DEV) {
    triggerAutomaticUpdateCheck = () => runAutomaticUpdateCheck(true)
    window.guanmoDev = { triggerAutomaticUpdateCheck }
    console.info('开发入口已就绪：await window.guanmoDev.triggerAutomaticUpdateCheck()')
  }
})

onBeforeUnmount(() => {
  if (timer) window.clearTimeout(timer)
  if (triggerAutomaticUpdateCheck && window.guanmoDev?.triggerAutomaticUpdateCheck === triggerAutomaticUpdateCheck) delete window.guanmoDev
})
</script>

<template><VueUpdateDetailsModal /></template>
