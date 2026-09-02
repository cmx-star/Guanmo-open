<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { PRODUCT_TOUR_STEPS, type ProductTourPlacement } from './productTourContent'

interface RectLike { left: number; top: number; right: number; bottom: number; width: number; height: number }
interface TourLayout { rects: RectLike[]; anchor: RectLike }
interface CardPosition { left: number; top: number; placement: ProductTourPlacement; anchorX: number; anchorY: number }
const props = defineProps<{ open: boolean; stepIndex: number }>()
const emit = defineEmits<{ close: []; stepChange: [index: number] }>()
const { t } = useI18n()
const CARD_WIDTH = 360
const CARD_GAP = 18
const VIEWPORT_PADDING = 16
const card = ref<HTMLDivElement | null>(null)
const layout = ref<TourLayout | null>(null)
const position = ref<CardPosition | null>(null)
const targetMissing = ref(false)
let resizeObserver: ResizeObserver | null = null
let measureFrame: number | undefined
const currentStep = computed(() => PRODUCT_TOUR_STEPS[props.stepIndex])
const isLastStep = computed(() => props.stepIndex === PRODUCT_TOUR_STEPS.length - 1)
const cardStyle = computed(() => targetMissing.value || !position.value ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' } : { left: `${position.value.left}px`, top: `${position.value.top}px` })

function readRect(element: Element): RectLike { const rect = element.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } }
function readLayout(target: string | string[]): TourLayout | null {
  const elements = (Array.isArray(target) ? target : [target]).flatMap((selector) => Array.from(document.querySelectorAll(selector)))
  const rects = elements.map(readRect).filter((rect) => rect.width > 0 && rect.height > 0)
  if (!rects.length) return null
  const anchor = { left: Math.min(...rects.map((rect) => rect.left)), top: Math.min(...rects.map((rect) => rect.top)), right: Math.max(...rects.map((rect) => rect.right)), bottom: Math.max(...rects.map((rect) => rect.bottom)), width: 0, height: 0 }
  anchor.width = anchor.right - anchor.left; anchor.height = anchor.bottom - anchor.top
  return { rects, anchor }
}
function choosePosition(anchor: RectLike, preferred: ProductTourPlacement, cardWidth: number, cardHeight: number): CardPosition {
  const fits: Record<ProductTourPlacement, boolean> = { top: anchor.top - CARD_GAP - cardHeight >= VIEWPORT_PADDING, right: window.innerWidth - anchor.right - CARD_GAP - cardWidth >= VIEWPORT_PADDING, bottom: window.innerHeight - anchor.bottom - CARD_GAP - cardHeight >= VIEWPORT_PADDING, left: anchor.left - CARD_GAP - cardWidth >= VIEWPORT_PADDING }
  const placement = [preferred, 'bottom', 'right', 'top', 'left'].find((candidate) => fits[candidate as ProductTourPlacement]) as ProductTourPlacement | undefined ?? 'bottom'
  const clamp = (value: number, maximum: number) => Math.max(VIEWPORT_PADDING, Math.min(value, maximum - VIEWPORT_PADDING))
  let left = anchor.left + anchor.width / 2 - cardWidth / 2; let top = anchor.bottom + CARD_GAP
  if (placement === 'top') top = anchor.top - CARD_GAP - cardHeight
  if (placement === 'right') { left = anchor.right + CARD_GAP; top = anchor.top + anchor.height / 2 - cardHeight / 2 }
  if (placement === 'left') { left = anchor.left - CARD_GAP - cardWidth; top = anchor.top + anchor.height / 2 - cardHeight / 2 }
  return { left: clamp(left, window.innerWidth - cardWidth), top: clamp(top, window.innerHeight - cardHeight), placement, anchorX: placement === 'left' ? anchor.left : placement === 'right' ? anchor.right : clamp(anchor.left + anchor.width / 2, window.innerWidth), anchorY: placement === 'top' ? anchor.top : placement === 'bottom' ? anchor.bottom : clamp(anchor.top + anchor.height / 2, window.innerHeight) }
}
function measure(): void {
  if (!props.open || !currentStep.value) return
  const nextLayout = readLayout(currentStep.value.target)
  layout.value = nextLayout; targetMissing.value = !nextLayout
  position.value = nextLayout ? choosePosition(nextLayout.anchor, currentStep.value.placement, card.value?.getBoundingClientRect().width || CARD_WIDTH, card.value?.getBoundingClientRect().height || 220) : null
}
function onViewportChange(): void { measure() }
function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return
  event.preventDefault(); event.stopPropagation()
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowLeft' && props.stepIndex > 0) emit('stepChange', props.stepIndex - 1)
  if (event.key === 'ArrowRight' && !isLastStep.value) emit('stepChange', props.stepIndex + 1)
}
function setupObservers(): void {
  resizeObserver?.disconnect(); resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onViewportChange)
  const target = currentStep.value?.target
  for (const selector of target ? (Array.isArray(target) ? target : [target]) : []) document.querySelectorAll(selector).forEach((element) => resizeObserver?.observe(element))
}
function cleanup(): void { cancelAnimationFrame(measureFrame ?? 0); window.removeEventListener('resize', onViewportChange); window.removeEventListener('scroll', onViewportChange, true); window.removeEventListener('keydown', onKeydown, true); resizeObserver?.disconnect(); resizeObserver = null }
watch(() => [props.open, props.stepIndex], async ([open]) => {
  cleanup()
  if (!open) return
  await nextTick(); card.value?.focus(); window.addEventListener('resize', onViewportChange); window.addEventListener('scroll', onViewportChange, true); window.addEventListener('keydown', onKeydown, true); setupObservers()
  let attempts = 0
  const retry = () => { measure(); if (attempts++ < 8) measureFrame = requestAnimationFrame(retry) }
  retry()
}, { immediate: true })
onBeforeUnmount(cleanup)
</script>

<template>
  <Teleport to="body">
    <div v-if="open && currentStep" class="gm-product-tour" role="presentation" @pointerdown.stop>
      <div v-for="(rect, index) in layout?.rects" :key="`${currentStep.id}-${index}`" class="gm-product-tour__target" :style="{ left: `${rect.left - 4}px`, top: `${rect.top - 4}px`, width: `${rect.width + 8}px`, height: `${rect.height + 8}px` }"></div>
      <svg v-if="position && layout" class="gm-product-tour__line" aria-hidden="true"><line :x1="position.left + CARD_WIDTH / 2" :y1="position.placement === 'top' ? position.top + 220 : position.top" :x2="position.anchorX" :y2="position.anchorY" /></svg>
      <div ref="card" class="gm-product-tour__card" :style="cardStyle" role="dialog" aria-modal="true" aria-labelledby="product-tour-title" aria-describedby="product-tour-description" tabindex="-1">
        <div class="gm-product-tour__eyebrow">{{ t('productTour.progress', { current: stepIndex + 1, total: PRODUCT_TOUR_STEPS.length }) }}</div>
        <h2 id="product-tour-title">{{ currentStep.title }}</h2>
        <p id="product-tour-description">{{ targetMissing ? t('productTour.targetMissing') : currentStep.content }}</p>
        <div class="gm-product-tour__actions"><button type="button" class="gm-product-tour__skip" @click="emit('close')">{{ t('productTour.skip') }}</button><div><button type="button" class="gm-product-tour__secondary" :disabled="stepIndex === 0" :aria-label="t('productTour.previous')" @click="emit('stepChange', stepIndex - 1)"><ChevronLeft :size="16" aria-hidden="true" />{{ t('productTour.previous') }}</button><button type="button" class="gm-product-tour__primary" :aria-label="isLastStep ? t('productTour.finish') : t('productTour.next')" @click="isLastStep ? emit('close') : emit('stepChange', stepIndex + 1)">{{ isLastStep ? t('productTour.finish') : t('productTour.next') }}<ChevronRight v-if="!isLastStep" :size="16" aria-hidden="true" /></button></div></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.gm-product-tour { position: fixed; z-index: 1200; inset: 0; background: rgb(0 0 0 / 55%); }.gm-product-tour__target { position: fixed; pointer-events: none; border: 2px solid var(--gm-primary); border-radius: var(--gm-radius-lg); box-shadow: 0 0 0 4px color-mix(in srgb, var(--gm-primary) 22%, transparent), 0 0 24px color-mix(in srgb, var(--gm-primary) 45%, transparent); }.gm-product-tour__line { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; }.gm-product-tour__line line { stroke: var(--gm-primary); stroke-width: 2; stroke-dasharray: 5 4; }.gm-product-tour__card { position: fixed; width: min(360px, calc(100vw - 32px)); padding: 20px; border: 1px solid var(--gm-border); border-radius: var(--gm-radius-lg); color: var(--gm-text); background: var(--gm-surface); box-shadow: var(--gm-shadow-lg); outline: none; }.gm-product-tour__eyebrow { margin-bottom: 4px; color: var(--gm-primary); font-size: var(--gm-text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }.gm-product-tour__card h2 { margin: 0; font-size: var(--gm-text-lg); }.gm-product-tour__card p { margin: 12px 0 0; color: var(--gm-text-secondary); line-height: 1.65; white-space: pre-line; }.gm-product-tour__actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 20px; }.gm-product-tour__actions > div { display: flex; gap: 8px; }.gm-product-tour__actions button { display: inline-flex; min-height: 30px; align-items: center; gap: 4px; border-radius: var(--gm-radius-md); font-size: var(--gm-text-sm); cursor: pointer; }.gm-product-tour__skip { padding: 0; border: 0; color: var(--gm-text-tertiary); background: transparent; }.gm-product-tour__skip:hover { color: var(--gm-text); }.gm-product-tour__secondary { padding: 5px 10px; border: 1px solid var(--gm-border); color: var(--gm-text-secondary); background: transparent; }.gm-product-tour__secondary:hover { border-color: color-mix(in srgb, var(--gm-primary) 50%, var(--gm-border)); color: var(--gm-primary); }.gm-product-tour__secondary:disabled { cursor: not-allowed; opacity: .4; }.gm-product-tour__primary { padding: 5px 10px; border: 1px solid var(--gm-primary); color: var(--gm-on-primary); background: var(--gm-primary); }.gm-product-tour__primary:hover { background: var(--gm-primary-hover); }
</style>
