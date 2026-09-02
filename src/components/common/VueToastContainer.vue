<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useToastStore, type ToastItem } from '@/stores/toastStore'

const { t } = useI18n()
const toasts = ref<ToastItem[]>(useToastStore.getState().toasts)

const typeClass: Record<ToastItem['type'], string> = {
  success: 'gm-vue-toast__accent--success',
  info: 'gm-vue-toast__accent--info',
  warning: 'gm-vue-toast__accent--warning',
  error: 'gm-vue-toast__accent--error',
}

const unsubscribe = useToastStore.subscribe((state) => {
  toasts.value = state.toasts
})

onMounted(() => {
  toasts.value = useToastStore.getState().toasts
})

onBeforeUnmount(unsubscribe)

function dismiss(id: string): void {
  useToastStore.getState().removeToast(id)
}

function runAction(toast: ToastItem, action: ToastItem['actions'][number]): void {
  dismiss(toast.id)
  void Promise.resolve(action.onClick()).catch((error) => {
    console.warn('[Toast] Action failed:', error)
  })
}
</script>

<template>
  <div v-if="toasts.length" class="gm-vue-toasts" aria-live="polite" aria-relevant="additions">
    <section
      v-for="toast in toasts"
      :key="toast.id"
      class="gm-vue-toast"
      role="status"
      @mouseenter="useToastStore.getState().pauseToast(toast.id)"
      @mouseleave="useToastStore.getState().resumeToast(toast.id)"
    >
      <i class="gm-vue-toast__accent" :class="typeClass[toast.type]" aria-hidden="true"></i>
      <div class="gm-vue-toast__content">
        <strong v-if="toast.title" class="gm-vue-toast__title">{{ toast.title }}</strong>
        <p class="gm-vue-toast__message">{{ toast.message }}</p>
        <div v-if="toast.actions.length" class="gm-vue-toast__actions">
          <button
            v-for="action in toast.actions"
            :key="action.label"
            type="button"
            :class="{ 'gm-vue-toast__action--primary': action.primary }"
            @click="runAction(toast, action)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
      <button
        v-if="toast.type === 'error' || toast.title || toast.actions.length"
        type="button"
        class="gm-vue-toast__close"
        :aria-label="t('common.closeNotification')"
        :title="t('common.closeNotification')"
        @click="dismiss(toast.id)"
      >
        <X :size="14" stroke-width="2" aria-hidden="true" />
      </button>
    </section>
  </div>
</template>

<style scoped>
.gm-vue-toasts { position: fixed; z-index: 1100; top: 80px; right: 16px; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.gm-vue-toast { display: flex; min-width: 240px; max-width: 380px; padding: 12px 16px; align-items: stretch; gap: 12px; pointer-events: auto; color: var(--gm-text); background: color-mix(in srgb, var(--gm-surface) 95%, transparent); border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); box-shadow: var(--gm-shadow-md); backdrop-filter: blur(8px); animation: gm-vue-toast-in var(--gm-duration-base) ease-out both; }
.gm-vue-toast__accent { width: 4px; min-height: 20px; flex: 0 0 auto; border-radius: var(--gm-radius-sm); background: var(--gm-primary); }
.gm-vue-toast__accent--success { background: var(--gm-success); }.gm-vue-toast__accent--info { background: var(--gm-primary); }.gm-vue-toast__accent--warning { background: var(--gm-warning); }.gm-vue-toast__accent--error { background: var(--gm-error); }
.gm-vue-toast__content { min-width: 0; flex: 1; }.gm-vue-toast__title { display: block; margin-bottom: 2px; font-size: 13px; line-height: 1.4; }.gm-vue-toast__message { margin: 0; color: var(--gm-text-secondary); font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
.gm-vue-toast__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }.gm-vue-toast__actions button { padding: 4px 10px; color: var(--gm-text-secondary); background: transparent; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-md); cursor: pointer; font-size: 12px; font-weight: 700; }.gm-vue-toast__actions button:hover { border-color: color-mix(in srgb, var(--gm-primary) 40%, var(--gm-border)); color: var(--gm-primary); }.gm-vue-toast__actions .gm-vue-toast__action--primary { color: var(--gm-text-on-primary); background: var(--gm-primary); border-color: var(--gm-primary); }.gm-vue-toast__actions .gm-vue-toast__action--primary:hover { color: var(--gm-text-on-primary); background: var(--gm-primary-hover); border-color: var(--gm-primary-hover); }
.gm-vue-toast__close { display: grid; width: 20px; height: 20px; padding: 0; flex: 0 0 auto; place-items: center; color: var(--gm-text-tertiary); background: transparent; border: 0; border-radius: var(--gm-radius-sm); cursor: pointer; }.gm-vue-toast__close:hover { color: var(--gm-text); background: var(--gm-surface-hover); }
@keyframes gm-vue-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
</style>
