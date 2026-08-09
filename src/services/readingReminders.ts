import {
  loadReadingReminderById,
  loadReadingReminders,
  persistReadingReminder,
  updateReadingReminderState,
  type ReadingReminder,
} from './database/readingReminders'
import {
  notificationIdForReminder,
  readingReminderNotificationAdapter,
  type ReadingReminderNotificationAdapter,
} from './readingReminderNotifications'

export interface CreateReadingReminderInput {
  id: string
  title: string
  description?: string | null
  dueAtUtc: number
  createdTimezone: string
  sourceArtifactId?: string | null
  sourceFilePath?: string | null
  sourceMessageId?: string | null
}

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'notification_unavailable') return message
  if (message === 'desktop_notification_scheduling_unsupported') return message
  if (/permission/i.test(message)) return 'notification_permission_denied'
  if (/due_time|due time/i.test(message)) return 'reminder_due_time_invalid'
  return 'notification_schedule_failed'
}

export async function createReadingReminder(
  input: CreateReadingReminderInput,
  adapter: ReadingReminderNotificationAdapter = readingReminderNotificationAdapter,
): Promise<ReadingReminder> {
  const existing = await loadReadingReminderById(input.id)
  if (existing && ['scheduled', 'fired'].includes(existing.status)) return existing

  const notificationId = existing?.notificationId ?? notificationIdForReminder(input.id)
  await persistReadingReminder({
    ...input,
    status: 'pending',
    notificationId,
    errorCode: null,
  })

  try {
    const granted = await adapter.ensurePermission(true)
    if (!granted) throw new Error('notification_permission_denied')
    await adapter.schedule({
      id: notificationId,
      title: input.title,
      body: input.description || undefined,
      dueAtUtc: input.dueAtUtc,
    })
    await updateReadingReminderState(input.id, 'scheduled', { notificationId, errorCode: null })
  } catch (error) {
    await updateReadingReminderState(input.id, 'failed', {
      notificationId,
      errorCode: errorCode(error),
    })
    throw error
  }
  return (await loadReadingReminderById(input.id))!
}

export async function cancelReadingReminder(
  id: string,
  adapter: ReadingReminderNotificationAdapter = readingReminderNotificationAdapter,
): Promise<void> {
  const reminder = await loadReadingReminderById(id)
  if (!reminder || reminder.status === 'cancelled') return
  await updateReadingReminderState(id, 'cancel_pending', { errorCode: null })
  try {
    if (reminder.notificationId) await adapter.cancel(reminder.notificationId)
    await updateReadingReminderState(id, 'cancelled', { errorCode: null })
  } catch (error) {
    await updateReadingReminderState(id, 'failed', { errorCode: 'notification_cancel_failed' })
    throw error
  }
}

export interface ReadingReminderReconcileResult {
  scheduled: number
  fired: number
  failed: number
  cancelled: number
}

export async function reconcileReadingReminders(
  adapter: ReadingReminderNotificationAdapter = readingReminderNotificationAdapter,
  now = Date.now(),
): Promise<ReadingReminderReconcileResult> {
  const result: ReadingReminderReconcileResult = { scheduled: 0, fired: 0, failed: 0, cancelled: 0 }
  const reminders = await loadReadingReminders()
  if (reminders.length === 0) return result

  let granted = false
  let pendingIds = new Set<number>()
  let reconciliationErrorCode: string | null = null
  try {
    granted = await adapter.ensurePermission(false)
    if (granted) pendingIds = await adapter.pendingIds()
  } catch (error) {
    granted = false
    reconciliationErrorCode = errorCode(error)
  }

  for (const reminder of reminders) {
    if (reminder.status === 'cancel_pending') {
      try {
        if (granted && reminder.notificationId) await adapter.cancel(reminder.notificationId)
        await updateReadingReminderState(reminder.id, 'cancelled', { errorCode: null })
        result.cancelled += 1
      } catch {
        await updateReadingReminderState(reminder.id, 'failed', { errorCode: 'notification_cancel_failed' })
        result.failed += 1
      }
      continue
    }
    if (!['pending', 'scheduled'].includes(reminder.status)) continue
    if (reminder.dueAtUtc <= now) {
      await updateReadingReminderState(reminder.id, 'fired', { errorCode: null })
      result.fired += 1
      continue
    }
    if (!granted) {
      await updateReadingReminderState(reminder.id, 'failed', {
        errorCode: reconciliationErrorCode ?? 'notification_permission_unavailable',
      })
      result.failed += 1
      continue
    }
    if (reminder.notificationId && pendingIds.has(reminder.notificationId)) continue
    const notificationId = reminder.notificationId ?? notificationIdForReminder(reminder.id)
    try {
      await adapter.schedule({
        id: notificationId,
        title: reminder.title,
        body: reminder.description || undefined,
        dueAtUtc: reminder.dueAtUtc,
      })
      await updateReadingReminderState(reminder.id, 'scheduled', { notificationId, errorCode: null })
      result.scheduled += 1
    } catch {
      await updateReadingReminderState(reminder.id, 'failed', {
        notificationId,
        errorCode: 'notification_schedule_failed',
      })
      result.failed += 1
    }
  }
  return result
}
