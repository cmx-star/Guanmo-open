import { isTauri } from '@tauri-apps/api/core'

export interface ReadingReminderNotificationAdapter {
  ensurePermission(request: boolean): Promise<boolean>
  schedule(input: { id: number; title: string; body?: string; dueAtUtc: number }): Promise<void>
  pendingIds(): Promise<Set<number>>
  cancel(id: number): Promise<void>
}

async function loadNotificationPlugin() {
  if (!isTauri()) throw new Error('notification_unavailable')
  return import('@tauri-apps/plugin-notification')
}

export function notificationIdForReminder(reminderId: string): number {
  let hash = 2166136261
  for (let index = 0; index < reminderId.length; index += 1) {
    hash ^= reminderId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 1) || 1
}

export const readingReminderNotificationAdapter: ReadingReminderNotificationAdapter = {
  async ensurePermission(request) {
    const plugin = await loadNotificationPlugin()
    if (await plugin.isPermissionGranted()) return true
    if (!request) return false
    return (await plugin.requestPermission()) === 'granted'
  },

  async schedule(input) {
    if (!Number.isInteger(input.id) || input.id <= 0) throw new Error('notification_id_invalid')
    if (!Number.isFinite(input.dueAtUtc) || input.dueAtUtc <= Date.now()) {
      throw new Error('reminder_due_time_invalid')
    }
    await loadNotificationPlugin()
    throw new Error('desktop_notification_scheduling_unsupported')
  },

  async pendingIds() {
    await loadNotificationPlugin()
    throw new Error('desktop_notification_scheduling_unsupported')
  },

  async cancel(id) {
    await loadNotificationPlugin()
    if (!Number.isInteger(id) || id <= 0) throw new Error('notification_id_invalid')
    throw new Error('desktop_notification_scheduling_unsupported')
  },
}
