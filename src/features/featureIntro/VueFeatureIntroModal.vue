<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { FeatureIntroItem } from './featureIntroContent'

const props = defineProps<{ open: boolean; features: FeatureIntroItem[] }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const step = ref(0)
const closing = ref(false)
const entering = ref(true)
const imageLoading = ref(true)
let closeTimer: number | undefined
let enterFrame: number | undefined

const feature = computed(() => props.features[step.value])
const totalSteps = computed(() => props.features.length)

function requestClose(): void {
  if (closing.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    emit('close')
    return
  }
  closing.value = true
  closeTimer = window.setTimeout(() => emit('close'), 200)
}

function goPrev(): void { if (step.value > 0) step.value -= 1 }
function goNext(): void { if (step.value < totalSteps.value - 1) step.value += 1 }
function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key === 'Escape') requestClose()
  else if (event.key === 'ArrowLeft') goPrev()
  else if (event.key === 'ArrowRight') goNext()
}

watch(() => props.open, (open) => {
  window.removeEventListener('keydown', onKeydown)
  window.clearTimeout(closeTimer)
  cancelAnimationFrame(enterFrame ?? 0)
  if (!open) {
    closing.value = false
    entering.value = true
    step.value = 0
    return
  }
  entering.value = true
  window.addEventListener('keydown', onKeydown)
  enterFrame = requestAnimationFrame(() => { enterFrame = window.setTimeout(() => { entering.value = false }, 0) })
}, { immediate: true })

watch([step, feature], () => { imageLoading.value = Boolean(feature.value?.image) }, { immediate: true })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); window.clearTimeout(closeTimer); cancelAnimationFrame(enterFrame ?? 0) })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="gm-feature-intro-scrim" :data-visible="!entering && !closing" @mousedown.self="requestClose">
      <section class="gm-feature-intro-dialog" :data-visible="!entering && !closing" role="dialog" aria-modal="true" :aria-label="t('featureIntro.title')">
        <button type="button" class="gm-feature-intro-close" :aria-label="t('common.close')" :title="t('common.close')" @click="requestClose"><X :size="17" aria-hidden="true" /></button>
        <div class="gm-feature-intro-content">
          <button type="button" class="gm-feature-intro-nav gm-feature-intro-nav--previous" :aria-label="t('featureIntro.previous')" :title="t('featureIntro.previous')" :disabled="step === 0" @click="goPrev"><ChevronLeft :size="21" aria-hidden="true" /></button>
          <div v-if="feature" class="gm-feature-intro-detail">
            <div v-if="feature.image" class="gm-feature-intro-image">
              <div v-if="imageLoading" class="gm-feature-intro-spinner" aria-hidden="true"></div>
              <div v-if="feature.image.startsWith('<svg')" v-show="!imageLoading" class="gm-feature-intro-image__svg" v-html="feature.image" />
              <img v-else v-show="!imageLoading" :src="feature.image" :alt="feature.title" @load="imageLoading = false" @error="imageLoading = false" />
            </div>
            <div class="gm-feature-intro-copy">
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
            </div>
          </div>
          <button type="button" class="gm-feature-intro-nav gm-feature-intro-nav--next" :aria-label="t('featureIntro.next')" :title="t('featureIntro.next')" :disabled="step === totalSteps - 1" @click="goNext"><ChevronRight :size="21" aria-hidden="true" /></button>
        </div>
        <div v-if="totalSteps > 1" class="gm-feature-intro-steps" :aria-label="t('featureIntro.progress')">
          <button v-for="(_, index) in features" :key="index" type="button" :aria-label="t('featureIntro.step', { step: index + 1 })" :aria-current="index === step ? 'step' : undefined" :data-active="index === step" @click="step = index"></button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.gm-feature-intro-scrim { position: fixed; z-index: 1100; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgb(0 0 0 / 45%); opacity: 0; transition: opacity 200ms; }
.gm-feature-intro-scrim[data-visible='true'] { opacity: 1; }
.gm-feature-intro-dialog { position: relative; display: flex; width: min(768px, 100%); min-height: 480px; flex-direction: column; overflow: hidden; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); background: var(--gm-surface); box-shadow: var(--gm-shadow-lg); opacity: 0; transform: scale(.95); transition: opacity 200ms, transform 200ms; }
.gm-feature-intro-dialog[data-visible='true'] { opacity: 1; transform: scale(1); }
.gm-feature-intro-close, .gm-feature-intro-nav { position: absolute; z-index: 1; display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: var(--gm-radius-md); color: var(--gm-text-tertiary); background: transparent; cursor: pointer; }
.gm-feature-intro-close { top: 16px; right: 16px; }
.gm-feature-intro-nav { top: 50%; width: 40px; height: 40px; border-radius: 50%; transform: translateY(-50%); }
.gm-feature-intro-nav--previous { left: 8px; }.gm-feature-intro-nav--next { right: 8px; }
.gm-feature-intro-close:hover, .gm-feature-intro-nav:hover { color: var(--gm-text); background: var(--gm-surface-hover); }.gm-feature-intro-nav:disabled { cursor: default; opacity: .25; }
.gm-feature-intro-content { display: flex; flex: 1; align-items: center; padding: 8px; }.gm-feature-intro-detail { display: flex; width: 100%; min-height: 420px; flex: 1; flex-direction: column; }.gm-feature-intro-image { display: grid; width: min(576px, calc(100% - 96px)); max-height: 300px; min-height: 160px; margin: 18px auto 0; place-items: center; overflow: hidden; border: 1px solid color-mix(in srgb, var(--gm-border) 55%, transparent); border-radius: var(--gm-radius-md); }.gm-feature-intro-image img, .gm-feature-intro-image__svg { display: block; max-width: 100%; max-height: 300px; object-fit: contain; }.gm-feature-intro-spinner { width: 32px; height: 32px; border: 2px solid var(--gm-border); border-top-color: var(--gm-primary); border-radius: 50%; animation: gm-feature-spin 750ms linear infinite; }.gm-feature-intro-copy { display: flex; flex: 1; flex-direction: column; justify-content: end; padding: 18px 52px 14px; text-align: center; }.gm-feature-intro-copy h3 { margin: 0 0 8px; color: var(--gm-text); font-size: var(--gm-text-lg); }.gm-feature-intro-copy p { max-width: 560px; margin: 0 auto; color: var(--gm-text-secondary); line-height: 1.65; }.gm-feature-intro-steps { display: flex; gap: 10px; align-items: center; justify-content: center; padding: 16px 20px; border-top: 1px solid var(--gm-border); }.gm-feature-intro-steps button { width: 10px; height: 10px; padding: 0; border: 0; border-radius: 999px; background: var(--gm-border); cursor: pointer; transition: width 160ms, background 160ms; }.gm-feature-intro-steps button[data-active='true'] { width: 24px; background: var(--gm-primary); }@keyframes gm-feature-spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .gm-feature-intro-dialog { min-height: min(480px, calc(100vh - 40px)); }.gm-feature-intro-copy { padding-inline: 48px; }.gm-feature-intro-image { width: min(576px, calc(100% - 72px)); } }
</style>
