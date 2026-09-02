import { invoke } from '@tauri-apps/api/core'
import { initAiClient, initEmbeddingClient, isLocalApi, validateAiStatus } from '@/services/ai/aiClient'
import { getDatabaseRuntimeState, initDatabase } from '@/services/database/db'
import { detectLegacyData } from '@/services/database/legacyDetector'
import { migrateLegacyFileAccess } from '@/services/persistedFileAccess'
import { READING_REMINDER_FEATURE_AVAILABLE } from '@/services/readingReminderFeature'
import {
  getRestorablePersistedTabs,
  restorePersistedTabs,
  type PersistedTabRestoreIssue,
} from '@/services/sessionRestore'
import { ensureSettingsSecretsHydrated } from '@/services/settingsSecrets'
import { scheduleIdleTask } from '@/services/idleScheduler'
import { singletonManager, SINGLETON_IDS } from '@/services/singletonPromise'
import { markStartupPoint } from '@/services/startupPerformance'
import { toast } from '@/services/toast'
import { hasBootSnapshotContent } from '@/services/bootSnapshot'
import { useAppStore } from '@/stores/appStore'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { isTauri } from '@/hooks/useTauri'

export { getDatabaseRuntimeState, initDatabase, READING_REMINDER_FEATURE_AVAILABLE }

function logDuration(label: string, startedAt: number): void {
  console.info(`[Perf] ${label}: ${Math.round(performance.now() - startedAt)}ms`)
}

function showRestoreIssues(issues: PersistedTabRestoreIssue[]): void {
  if (issues.length === 0) return
  void import('@/services/sessionRestoreNotifications')
    .then(({ showSessionRestoreIssues }) => showSessionRestoreIssues(issues))
    .catch((error) => console.warn('[App] Restore issue notification failed:', error))
}

export async function restoreTabs(): Promise<void> {
  let openedFromFileAssociation = false
  if (isTauri()) {
    try {
      openedFromFileAssociation = await invoke<boolean>('has_pending_open_files')
    } catch (error) {
      console.warn('[App] Pending open file check failed:', error)
    }
  }

  if (openedFromFileAssociation) {
    useEditorStore.getState().resetTabsForExternalOpen()
    markStartupPoint('active-tab-disk-read-complete', { outcome: 'skipped-external-open' })
    markStartupPoint('startup-session-restore-complete', { outcome: 'skipped-external-open' })
    return
  }

  const restoreStartedAt = performance.now()
  const state = useEditorStore.getState()
  const restorableTabs = getRestorablePersistedTabs(state.tabs)
  const validIds = new Set(restorableTabs.map((tab) => tab.id))
  const activeTabId = state.activeTabId && validIds.has(state.activeTabId)
    ? state.activeTabId
    : restorableTabs[0]?.id ?? null
  const activeTab = restorableTabs.find((tab) => tab.id === activeTabId)
  state.restoreTabs(
    restorableTabs,
    activeTabId,
    state.rightPaneTabId && validIds.has(state.rightPaneTabId) ? state.rightPaneTabId : null,
  )

  const activeIssues: PersistedTabRestoreIssue[] = []
  let restoredActiveTabs: Awaited<ReturnType<typeof restorePersistedTabs>>
  try {
    restoredActiveTabs = activeTab
      ? await restorePersistedTabs([activeTab], {
          detectExternalChanges: hasBootSnapshotContent(activeTab),
          onTabRestoreIssue: (issue) => activeIssues.push(issue),
        })
      : []
  } catch (error) {
    markStartupPoint('active-tab-disk-read-complete', { outcome: 'failed' })
    markStartupPoint('startup-session-restore-complete', { outcome: 'failed', stage: 'active-restore' })
    throw error
  }

  const [restoredActiveTab] = restoredActiveTabs
  markStartupPoint('active-tab-disk-read-complete', { restored: Boolean(restoredActiveTab) })
  if (activeTab && restoredActiveTab) useEditorStore.getState().mergeRestoredTab(activeTab, restoredActiveTab)
  showRestoreIssues(activeIssues)
  markStartupPoint('startup-session-restore-complete', {
    outcome: activeTab ? (restoredActiveTab ? 'restored' : 'active-missing') : 'no-active-tab',
    tabs: restorableTabs.length,
  })
  logDuration('active tab restore', restoreStartedAt)

  const backgroundTabs = restorableTabs.filter((tab) => tab.id !== activeTabId)
  const backgroundIssues: PersistedTabRestoreIssue[] = []
  void restorePersistedTabs(backgroundTabs, {
    concurrency: 3,
    onTabRestored(restoredTab, index) {
      const originalTab = backgroundTabs[index]
      useEditorStore.getState().mergeRestoredTab(originalTab, restoredTab)
    },
    onTabRestoreIssue(issue) {
      backgroundIssues.push(issue)
    },
  }).then(() => {
    showRestoreIssues(backgroundIssues)
    logDuration('background tab restore', restoreStartedAt)
  }).catch((error) => {
    console.warn('[App] Background tab restore failed:', error)
  })
}

export function scheduleIdleWarmup(): void {
  scheduleIdleTask(
    SINGLETON_IDS.CHAT_AI,
    async () => {
      await ensureSettingsSecretsHydrated()
      const { ai } = useSettingsStore.getState()
      if ((ai.apiKey || isLocalApi(ai.baseUrl)) && ai.baseUrl && ai.chatModel) {
        await singletonManager.init(SINGLETON_IDS.CHAT_AI, async () => {
          const startedAt = performance.now()
          const provider = initAiClient(ai)
          logDuration('AI client init', startedAt)
          return provider
        })
      }
    },
    1,
    'AI 客户端初始化',
  )

  scheduleIdleTask(
    SINGLETON_IDS.EMBEDDING_AI,
    async () => {
      await ensureSettingsSecretsHydrated()
      const { ai } = useSettingsStore.getState()
      if ((ai.embedding.apiKey || isLocalApi(ai.embedding.baseUrl)) && ai.embedding.baseUrl && ai.embedding.embeddingModel) {
        await singletonManager.init(SINGLETON_IDS.EMBEDDING_AI, async () => {
          const startedAt = performance.now()
          const provider = initEmbeddingClient(ai.embedding)
          logDuration('Embedding client init', startedAt)
          return provider
        })
      }
    },
    2,
    'Embedding 客户端初始化',
  )

  scheduleIdleTask(
    'rag-index-warmup',
    async () => {
      const { warmNativeRagIndexWhileIdle } = await import('@/services/rag/warmupScheduler')
      await warmNativeRagIndexWhileIdle()
    },
    3,
    'RAG 索引预热',
  )

  window.setTimeout(() => {
    const startedAt = performance.now()
    ensureSettingsSecretsHydrated().then(validateAiStatus).then((status) => {
      useAppStore.getState().setAiStatus(status)
      logDuration('AI status validate', startedAt)
    }).catch((error) => {
      console.warn('[App] AI status validation failed:', error)
    })
  }, 3000)

  scheduleIdleTask(
    SINGLETON_IDS.LEGACY_FILE_ACCESS,
    async () => {
      if (!isTauri()) return
      const startedAt = performance.now()
      try {
        await migrateLegacyFileAccess()
        logDuration('legacy file access migration', startedAt)
      } catch (error) {
        console.warn('[App] Legacy file access migration failed:', error)
      }
    },
    7,
    '旧版文件访问迁移',
  )

  scheduleIdleTask(
    SINGLETON_IDS.LEGACY_DATA_DETECTION,
    async () => {
      if (!isTauri()) return
      const startedAt = performance.now()
      try {
        const detection = await detectLegacyData()
        if (detection.legacyDetected && !detection.userNoticed) console.log('[App] Legacy data detected:', detection)
        logDuration('legacy data detection', startedAt)
      } catch (error) {
        console.warn('[App] Legacy detection failed:', error)
      }
    },
    8,
    '旧版数据检测',
  )
}

export async function startReadingReminderRuntime(): Promise<(() => void) | undefined> {
  if (!READING_REMINDER_FEATURE_AVAILABLE) return undefined
  try {
    const { reconcileReadingReminders } = await import('@/services/readingReminders')
    await reconcileReadingReminders()
    const { startReadingReminderRuntime: start, stopReadingReminderRuntime: stop } = await import('@/services/readingReminderRuntime')
    start()
    return stop
  } catch (error) {
    console.warn('[Reminder] startup reconciliation failed:', error)
    return undefined
  }
}

export async function initializeApplication(): Promise<void> {
  const startedAt = performance.now()
  const secretsStartedAt = performance.now()
  void ensureSettingsSecretsHydrated().then(() => {
    markStartupPoint('secrets-hydrated')
    logDuration('settings secret hydration', secretsStartedAt)
  }).catch((error) => {
    console.warn('[App] Settings secret hydration failed:', error)
  })

  const databaseStartedAt = performance.now()
  const restoreStartedAt = performance.now()
  await Promise.all([
    initDatabase().then(() => {
      markStartupPoint('database-ready')
      logDuration('database init', databaseStartedAt)
    }),
    restoreTabs().then(() => logDuration('tabs restored', restoreStartedAt)),
  ])

  if (getDatabaseRuntimeState().status !== 'ready') throw new Error('Database not ready after init')
  logDuration('application initialization', startedAt)
}

export function showDatabaseInitFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[App] Database init failed:', message)
  toast.show({
    id: 'database-init-failed',
    title: '数据库初始化失败',
    message: '数据库初始化失败，部分数据可能无法保存',
    type: 'error',
    duration: null,
  })
}
