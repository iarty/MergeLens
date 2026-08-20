import type {
  ReviewNotificationAlarmScheduler,
  ReviewNotificationClock,
  ReviewNotificationPermissionGateway,
  ReviewNotificationPresenter,
  ReviewNotificationTabOpener,
} from '../ports/ReviewNotificationBrowser'
import type { ReviewNotificationSource } from '../ports/ReviewNotificationSource'
import type { ReviewNotificationStateRepository } from '../ports/ReviewNotificationStateRepository'

export interface PollReviewNotificationsDependencies {
  source: ReviewNotificationSource
  repository: ReviewNotificationStateRepository
  permission: ReviewNotificationPermissionGateway
  presenter: ReviewNotificationPresenter
  clock: ReviewNotificationClock
}

export interface ReconcileReviewNotificationScheduleDependencies {
  repository: ReviewNotificationStateRepository
  permission: ReviewNotificationPermissionGateway
  scheduler: ReviewNotificationAlarmScheduler
}

export interface OpenReviewNotificationTargetDependencies {
  repository: ReviewNotificationStateRepository
  presenter: ReviewNotificationPresenter
  tabOpener: ReviewNotificationTabOpener
}

export type ReviewNotificationTrigger =
  'alarm' | 'startup' | 'installed' | 'preferences' | 'permission'
