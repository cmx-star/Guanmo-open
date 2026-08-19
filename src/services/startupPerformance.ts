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
  | 'editor-first-visible'
  | 'preview-first-visible'
  | 'preview-render-complete'
  | 'app-ready'
  | 'app-module-ready'
  | 'main-module-evaluated'
  | 'create-root-start'
  | 'react-render-start'
  | 'react-mounted'
  | 'startup-shell-removed'
  | 'first-animation-frame'
  | 'startup-session-restore-complete'

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
    // 新增点位不在 PerfEventType 中：Extract 保证仅对既有兼容点位通过类型收窄
    eventMarker.mark(point as Extract<StartupPerformancePoint, PerfEventType>, metadata)
    if (point === 'app-ready') scheduleStartupTimelineReport()
  }
}

const STARTUP_TIMELINE_SEMANTICS: ReadonlyArray<{ point: string; semantic: string }> = [
  { point: 'html-start', semantic: 'HTML 解析开始（head 内首个同步 mark，导航零点为 timeOrigin）' },
  { point: 'startup-shell-dom-ready', semantic: '静态 Startup Shell DOM 已提交给解析器（未绘制）' },
  { point: 'html-parsed', semantic: 'HTML 解析到达文档尾部' },
  { point: 'main-module-requested', semantic: '开始请求/解析 main.tsx 静态依赖图' },
  { point: 'app-module-ready', semantic: '@app-entry 及静态依赖完成加载求值（与下一行同边界）' },
  { point: 'main-module-evaluated', semantic: 'main.tsx 模块体开始执行' },
  { point: 'frontend-bootstrap', semantic: '前端引导（历史点位）' },
  { point: 'create-root-start', semantic: '调用 ReactDOM.createRoot 之前' },
  { point: 'react-render-start', semantic: '调用 root.render 之前' },
  { point: 'react-mounted', semantic: 'React 首次真实 DOM commit 完成' },
  { point: 'startup-shell-removed', semantic: '静态 Shell 已被 React 接管移除' },
  { point: 'first-react-render', semantic: 'App 组件首次渲染执行' },
  { point: 'first-animation-frame', semantic: '首个 RAF callback 到达（不代表交互就绪）' },
  { point: 'app-shell-first-visible', semantic: '真实 AppShell 首次可见' },
  { point: 'app-shell-interactive', semantic: '真实 AppShell passive 交互就绪' },
  { point: 'database-init-start', semantic: '数据库初始化开始' },
  { point: 'database-plugin-loaded', semantic: '数据库插件加载完成' },
  { point: 'database-connection-opened', semantic: '数据库连接打开' },
  { point: 'database-schema-gate-complete', semantic: '数据库 schema 门禁完成' },
  { point: 'database-ready', semantic: '数据库就绪' },
  { point: 'active-tab-disk-read-complete', semantic: '活动标签磁盘读取/校验完成' },
  { point: 'startup-session-restore-complete', semantic: '启动关键路径会话恢复完成（不含后台标签）' },
  { point: 'secrets-hydrated', semantic: '设置密钥水合完成' },
  { point: 'active-document-first-visible', semantic: '活动文档首次真实可见' },
  { point: 'editor-first-visible', semantic: '编辑器 surface 首次可见' },
  { point: 'preview-first-visible', semantic: '预览 surface 首次可见' },
  { point: 'preview-render-complete', semantic: '预览渲染完成' },
  { point: 'app-ready', semantic: '后台就绪（数据库与启动关键路径恢复完成）' },
]

let startupTimelineReportScheduled = false

/** DEV 专用：app-ready 到达后延迟输出一次启动时间线，等待后续 surface 点位落盘。 */
function scheduleStartupTimelineReport(): void {
  if (startupTimelineReportScheduled) return
  startupTimelineReportScheduled = true
  setTimeout(() => printStartupTimeline(), 300)
}

function printStartupTimeline(): void {
  if (typeof performance === 'undefined') return
  const semantics = new Map(STARTUP_TIMELINE_SEMANTICS.map((item) => [item.point, item.semantic]))
  const startTimes = new Map<string, number>()
  for (const entry of performance.getEntriesByType('mark')) {
    if (!entry.name.startsWith(MARK_PREFIX)) continue
    const point = entry.name.slice(MARK_PREFIX.length)
    if (semantics.has(point) && !startTimes.has(point)) startTimes.set(point, entry.startTime)
  }

  const boundary = (point: string): string => {
    const startTime = startTimes.get(point)
    return startTime === undefined ? 'missing' : `${Math.round(startTime)}ms`
  }
  console.info(
    `[Startup] 静态ShellDOM ${boundary('startup-shell-dom-ready')}｜AppShell可见 ${boundary('app-shell-first-visible')}｜AppShell可交互 ${boundary('app-shell-interactive')}｜活动文档可见 ${boundary('active-document-first-visible')}｜后台appReady ${boundary('app-ready')}`,
  )

  const ordered = [...startTimes.entries()].sort((a, b) => a[1] - b[1])
  const rows = ordered.map(([point, startTime], index) => ({
    '点位': point,
    '距timeOrigin': `${Math.round(startTime)}ms`,
    '距上一点位': index === 0 ? '-' : `${Math.round(startTime - ordered[index - 1][1])}ms`,
    '语义': semantics.get(point) ?? '',
  }))
  for (const { point, semantic } of STARTUP_TIMELINE_SEMANTICS) {
    if (!startTimes.has(point)) {
      rows.push({ '点位': point, '距timeOrigin': 'missing', '距上一点位': 'missing', '语义': semantic })
    }
  }
  console.table(rows)
}
