import { onBeforeUnmount, shallowRef, type ShallowRef } from 'vue'

interface ZustandStore<TState> {
  getState: () => TState
  subscribe: (listener: (state: TState, previousState: TState) => void) => () => void
}

/**
 * Keep Vue templates reactive while the migration still uses the established
 * Zustand stores as the source of truth.
 */
export function useZustandSelector<TState, TSelected>(
  store: ZustandStore<TState>,
  selector: (state: TState) => TSelected,
  equals: (left: TSelected, right: TSelected) => boolean = Object.is,
): ShallowRef<TSelected> {
  const selected = shallowRef(selector(store.getState())) as ShallowRef<TSelected>
  const unsubscribe = store.subscribe((state) => {
    const next = selector(state)
    if (!equals(selected.value, next)) selected.value = next
  })

  onBeforeUnmount(unsubscribe)
  return selected
}
