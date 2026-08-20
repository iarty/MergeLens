import type { ReviewNotificationDelivery } from '../domain/ReviewNotification'

export interface ReviewNotificationAlarmScheduler {
  getIntervalMinutes(): Promise<number | null>
  schedule(intervalMinutes: number): Promise<void>
  clear(): Promise<void>
}

export interface ReviewNotificationPresenter {
  present(delivery: ReviewNotificationDelivery): Promise<void>
  clear(notificationId: string): Promise<void>
}

export interface ReviewNotificationPermissionGateway {
  isGranted(): Promise<boolean>
  request(): Promise<boolean>
}

export interface ReviewNotificationTabOpener {
  open(url: string): Promise<void>
}

export interface ReviewNotificationClock {
  now(): string
}
