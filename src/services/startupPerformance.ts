import { eventMarker, type PerfEventType } from '@/services/eventMarker'

export type StartupPerformancePoint =
  | 'frontend-bootstrap'
  | 'first-react-render'
  | 'app-shell-first-visible'
  | 'app-shell-interactive'
  | 'secrets-hydrated'
  | 'database-init-start'
  | 'database-plugin-loaded'
  | 'database-connection-opened'
  | 'database-schema-gate-complete'
  | 'database-ready'
  | 'active-tab-disk-read-complete'
  | 'active-document-first-visible'
  | 'app-ready'

const MARK_PREFIX = 'guanmo:startup:'
const completedPoints = new Set<StartupPerformancePoint>()
const pointWaiters = new Map<StartupPerformancePoint, Set<() => void>>()

export function waitForStartupPoint(point: StartupPerformancePoint): Promise<void> {
  if (completedPoints.has(point)) return Promise.resolve()
  return new Promise((resolve) => {
    const waiters = pointWaiters.get(point) ?? new Set<() => void>()
    waiters.add(resolve)
    pointWaiters.set(point, waiters)
  })
}

export function markStartupPoint(
  point: StartupPerformancePoint,
  metadata?: Record<string, unknown>,
): void {
  if (completedPoints.has(point)) return
  completedPoints.add(point)
  for (const resolve of pointWaiters.get(point) ?? []) resolve()
  pointWaiters.delete(point)

  if (typeof performance === 'undefined') return
  const markName = `${MARK_PREFIX}${point}`
  if (performance.getEntriesByName(markName, 'mark').length === 0) {
    performance.mark(markName)
  }
  if (import.meta.env.DEV) {
    eventMarker.mark(point as PerfEventType, metadata)
  }
}
