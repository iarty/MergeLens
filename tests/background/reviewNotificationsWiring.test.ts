import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('wxt/utils/storage', () => ({
  storage: { defineItem: vi.fn() },
}))

import {
  REVIEW_NOTIFICATION_ALARM_NAME,
  registerReviewNotificationBackground,
} from '@/modules/review-notifications'

const createEvent = <T extends (...args: never[]) => void>() => {
  const listeners = new Set<T>()
  return {
    listeners,
    addListener: vi.fn((listener: T) => {
      listeners.add(listener)
    }),
    removeListener: vi.fn((listener: T) => {
      listeners.delete(listener)
    }),
  }
}

describe('review notification background wiring', () => {
  const onAlarm = createEvent<(alarm: { name: string }) => void>()
  const onStartup = createEvent<() => void>()
  const onInstalled = createEvent<() => void>()
  const onClicked = createEvent<(notificationId: string) => void>()
  const onClosed = createEvent<(notificationId: string) => void>()
  const onAdded =
    createEvent<(permissions: { permissions?: string[] }) => void>()
  const onRemoved =
    createEvent<(permissions: { permissions?: string[] }) => void>()

  beforeEach(() => {
    for (const event of [
      onAlarm,
      onStartup,
      onInstalled,
      onClicked,
      onClosed,
      onAdded,
      onRemoved,
    ]) {
      event.listeners.clear()
      event.addListener.mockClear()
      event.removeListener.mockClear()
    }
    vi.stubGlobal('browser', {
      alarms: { onAlarm },
      runtime: { onStartup, onInstalled },
      notifications: { onClicked, onClosed },
      permissions: { onAdded, onRemoved },
    })
  })

  it('registers listeners synchronously, routes owned events, and cleans up', async () => {
    const repository = {
      getPreferences: vi.fn(async () => ({
        enabled: true,
        intervalMinutes: 15,
      })),
      savePreferences: vi.fn(),
      getSnapshot: vi.fn(async () => ({
        initialized: false,
        activeCandidateIds: [],
        updatedAt: null,
      })),
      saveSnapshot: vi.fn(async () => undefined),
      listRoutes: vi.fn(async () => []),
      saveRoutes: vi.fn(async () => undefined),
      subscribePreferences: vi.fn(() => vi.fn()),
    }
    const source = {
      listReviewRequests: vi.fn(async () => ({
        status: 'success',
        candidates: [],
      })),
    }
    const scheduler = {
      getIntervalMinutes: vi.fn(async () => null),
      schedule: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    }
    const permission = { isGranted: vi.fn(async () => true), request: vi.fn() }
    const presenter = { present: vi.fn(), clear: vi.fn(async () => undefined) }
    const tabOpener = { open: vi.fn(async () => undefined) }

    const dispose = registerReviewNotificationBackground({
      repository,
      source,
      scheduler,
      permission,
      presenter,
      tabOpener,
    } as never)

    for (const event of [
      onAlarm,
      onStartup,
      onInstalled,
      onClicked,
      onClosed,
      onAdded,
      onRemoved,
    ]) {
      expect(event.addListener).toHaveBeenCalledOnce()
    }
    expect(repository.subscribePreferences).toHaveBeenCalledOnce()

    onAlarm.listeners.forEach((listener) => listener({ name: 'foreign-alarm' }))
    expect(source.listReviewRequests).not.toHaveBeenCalled()
    onAlarm.listeners.forEach((listener) =>
      listener({ name: REVIEW_NOTIFICATION_ALARM_NAME }),
    )
    await vi.waitFor(() =>
      expect(source.listReviewRequests).toHaveBeenCalledOnce(),
    )
    onRemoved.listeners.forEach((listener) =>
      listener({ permissions: ['notifications'] }),
    )
    await vi.waitFor(() =>
      expect(repository.saveRoutes).toHaveBeenCalledWith([]),
    )
    expect(onClicked.removeListener).toHaveBeenCalledOnce()

    dispose()
    for (const event of [
      onAlarm,
      onStartup,
      onInstalled,
      onClicked,
      onClosed,
      onAdded,
      onRemoved,
    ]) {
      expect(event.removeListener).toHaveBeenCalledOnce()
      expect(event.listeners.size).toBe(0)
    }
  })

  it('starts without the optional notifications API and attaches after consent', () => {
    const browserApi = {
      alarms: { onAlarm },
      runtime: { onStartup, onInstalled },
      permissions: { onAdded, onRemoved },
    }
    vi.stubGlobal('browser', browserApi)
    const repository = {
      getPreferences: vi.fn(async () => ({
        enabled: false,
        intervalMinutes: 15,
      })),
      savePreferences: vi.fn(),
      getSnapshot: vi.fn(),
      saveSnapshot: vi.fn(),
      listRoutes: vi.fn(async () => []),
      saveRoutes: vi.fn(async () => undefined),
      subscribePreferences: vi.fn(() => vi.fn()),
    }
    const overrides = {
      repository,
      source: { listReviewRequests: vi.fn() },
      scheduler: {
        getIntervalMinutes: vi.fn(async () => null),
        schedule: vi.fn(),
        clear: vi.fn(),
      },
      permission: { isGranted: vi.fn(async () => false), request: vi.fn() },
      presenter: { present: vi.fn(), clear: vi.fn() },
      tabOpener: { open: vi.fn() },
    }

    const dispose = registerReviewNotificationBackground(overrides as never)
    expect(onAdded.addListener).toHaveBeenCalledOnce()
    expect(onClicked.addListener).not.toHaveBeenCalled()

    Object.assign(browserApi, { notifications: { onClicked, onClosed } })
    onAdded.listeners.forEach((listener) =>
      listener({ permissions: ['notifications'] }),
    )
    expect(onClicked.addListener).toHaveBeenCalledOnce()
    expect(onClosed.addListener).toHaveBeenCalledOnce()

    dispose()
  })
})
