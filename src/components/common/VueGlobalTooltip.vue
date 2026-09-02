<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

type TooltipPosition = {
  left: number
  top: number
  arrowLeft: number
  anchorCenter: number
  content: string
}

const margin = 8
const arrowMargin = 12
const fallbackWidth = 264
const tooltip = ref<TooltipPosition | null>(null)
const tooltipRef = ref<HTMLDivElement | null>(null)
let active: { element: HTMLElement; title: string } | null = null
let timer: number | null = null

function clear(): void {
  if (timer !== null) window.clearTimeout(timer)
  timer = null
  tooltip.value = null
  if (active?.element.isConnected) active.element.setAttribute('title', active.title)
  active = null
}

function positionFor(element: HTMLElement, width = fallbackWidth): Omit<TooltipPosition, 'content'> {
  const rect = element.getBoundingClientRect()
  const boundedWidth = Math.min(width, window.innerWidth - margin * 2)
  const anchorCenter = rect.left + rect.width / 2
  const left = Math.min(Math.max(anchorCenter - boundedWidth / 2, margin), window.innerWidth - boundedWidth - margin)
  const arrowLeft = Math.min(Math.max(anchorCenter - left, arrowMargin), boundedWidth - arrowMargin)
  return { left, top: rect.bottom + 7, arrowLeft, anchorCenter }
}

function show(element: HTMLElement): void {
  if (active?.element === element) return
  clear()
  const title = element.getAttribute('title')
  if (!title) return
  element.removeAttribute('title')
  active = { element, title }
  const position = positionFor(element)
  timer = window.setTimeout(async () => {
    tooltip.value = { content: title, ...position }
    await nextTick()
    if (!tooltip.value || !tooltipRef.value) return
    tooltip.value = { content: title, ...positionFor(element, tooltipRef.value.offsetWidth) }
  }, 320)
}

function findTrigger(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[title]') : null
}

function handlePointerOver(event: PointerEvent): void {
  const trigger = findTrigger(event.target)
  if (trigger) show(trigger)
}

function handlePointerOut(event: PointerEvent): void {
  const element = active?.element
  if (!element || (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return
  clear()
}

function handleFocusIn(event: FocusEvent): void {
  const trigger = findTrigger(event.target)
  if (trigger) show(trigger)
}

onMounted(() => {
  document.addEventListener('pointerover', handlePointerOver)
  document.addEventListener('pointerout', handlePointerOut)
  document.addEventListener('focusin', handleFocusIn)
  document.addEventListener('focusout', clear)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerover', handlePointerOver)
  document.removeEventListener('pointerout', handlePointerOut)
  document.removeEventListener('focusin', handleFocusIn)
  document.removeEventListener('focusout', clear)
  clear()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="tooltip"
      ref="tooltipRef"
      role="tooltip"
      class="gm-tooltip"
      :style="{
        left: `${tooltip.left}px`,
        top: `${tooltip.top}px`,
        '--gm-tooltip-arrow-left': `${tooltip.arrowLeft}px`,
      }"
    >
      {{ tooltip.content }}
    </div>
  </Teleport>
</template>
