import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReadingReminder } from '@/services/database/readingReminders'
import type { ReadingReminderNotificationAdapter } from '@/services/readingReminderNotifications'

const repository = vi.hoisted(() => ({
  reminders: new Map<string, ReadingReminder>(),
}))

vi.mock('@/services/database/readingReminders', () => ({
  loadReadingReminderById: vi.fn(async (id: string) => repository.reminders.get(id)),
  loadReadingReminders: vi.fn(async () => [...repository.reminders.values()]),
  persistReadingReminder: vi.fn(async (input: Omit<ReadingReminder, 'createdAt' | 'updatedAt'>) => {
    const now = Date.now()
    repository.reminders.set(input.id, {
      description: null,
      sourceArtifactId: null,
      sourceFilePath: null,
      sourceMessageId: null,
      notificationId: null,
      errorCode: null,
      ...input,
      createdAt: now,
      updatedAt: now,
    })
  }),
  updateReadingReminderState: vi.fn(async (
    id: string,
    status: ReadingReminder['status'],
    options: { notificationId?: number | null; errorCode?: string | null } = {},
  ) => {
    const current = repository.reminders.get(id)
    if (!current) return
    repository.reminders.set(id, {
      ...current,
      status,
      ...(Object.prototype.hasOwnProperty.call(options, 'notificationId')
        ? { notificationId: options.notificationId ?? null }
        : {}),
      errorCode: options.errorCode ?? null,
      updatedAt: Date.now(),
    })
  }),
}))

import { notificationIdForReminder } from '@/services/readingReminderNotifications'
import {
  cancelReadingReminder,
  createReadingReminder,
  reconcileReadingReminders,
} from '@/services/readingReminders'

function reminder(overrides: Partial<ReadingReminder> = {}): ReadingReminder {
  const now = Date.now()
  return {
    id: 'reminder-1',
    title: '复习章节',
    description: '回顾重点',
    dueAtUtc: now + 60_000,
    createdTimezone: 'Asia/Shanghai',
    status: 'scheduled',
    sourceArtifactId: null,
    sourceFilePath: null,
    sourceMessageId: null,
    notificationId: 42,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function adapter(overrides: Partial<ReadingReminderNotificationAdapter> = {}): ReadingReminderNotificationAdapter {
  return {
    ensurePermission: vi.fn(async () => true),
    schedule: vi.fn(async () => undefined),
    pendingIds: vi.fn(async () => new Set<number>()),
    cancel: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('reading reminder lifecycle', () => {
  beforeEach(() => repository.reminders.clear())

  it('derives a stable positive 32-bit notification id', () => {
    const id = notificationIdForReminder('reminder-action-1')
    expect(id).toBe(notificationIdForReminder('reminder-action-1'))
    expect(id).toBeGreaterThan(0)
    expect(id).toBeLessThanOrEqual(0x7fffffff)
  })

  it('persists pending before scheduling and finishes scheduled', async () => {
    const notifications = adapter()
    const dueAtUtc = Date.now() + 60_000
    const created = await createReadingReminder({
      id: 'reminder-create',
      title: '复习章节',
      dueAtUtc,
      createdTimezone: 'Asia/Shanghai',
    }, notifications)
    expect(notifications.ensurePermission).toHaveBeenCalledWith(true)
    expect(notifications.schedule).toHaveBeenCalledWith(expect.objectContaining({ dueAtUtc }))
    expect(created.status).toBe('scheduled')
    expect(created.errorCode).toBeNull()
  })

  it('keeps an anonymous failure state when permission is denied', async () => {
    const notifications = adapter({ ensurePermission: vi.fn(async () => false) })
    await expect(createReadingReminder({
      id: 'reminder-denied',
      title: '复习章节',
      dueAtUtc: Date.now() + 60_000,
      createdTimezone: 'Asia/Shanghai',
    }, notifications)).rejects.toThrow('notification_permission_denied')
    expect(repository.reminders.get('reminder-denied')).toMatchObject({
      status: 'failed',
      errorCode: 'notification_permission_denied',
    })
  })

  it('reconciles missing registrations and marks overdue reminders fired', async () => {
    const now = Date.now()
    repository.reminders.set('missing', reminder({ id: 'missing', notificationId: 7 }))
    repository.reminders.set('overdue', reminder({ id: 'overdue', dueAtUtc: now - 1_000 }))
    const notifications = adapter()
    const result = await reconcileReadingReminders(notifications, now)
    expect(result).toEqual({ scheduled: 1, fired: 1, failed: 0, cancelled: 0 })
    expect(repository.reminders.get('missing')?.status).toBe('scheduled')
    expect(repository.reminders.get('overdue')?.status).toBe('fired')
  })

  it('finishes cancellation only after the notification adapter succeeds', async () => {
    repository.reminders.set('cancel-me', reminder({ id: 'cancel-me', notificationId: 9 }))
    const notifications = adapter()
    await cancelReadingReminder('cancel-me', notifications)
    expect(notifications.cancel).toHaveBeenCalledWith(9)
    expect(repository.reminders.get('cancel-me')?.status).toBe('cancelled')
  })
})
