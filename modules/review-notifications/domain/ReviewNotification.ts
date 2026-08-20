export const REVIEW_NOTIFICATION_ALARM_NAME =
  'mergelens.review-notifications.poll'
export const REVIEW_NOTIFICATION_ID_PREFIX = 'mergelens-review:'
export const REVIEW_NOTIFICATION_STORAGE_VERSION = 1
export const REVIEW_NOTIFICATION_INTERVALS = [5, 15, 30, 60] as const
export const MAX_REVIEW_NOTIFICATION_CANDIDATES = 100
export const MAX_REVIEW_NOTIFICATIONS_PER_POLL = 3
export const MAX_NOTIFICATION_ROUTES = 25

export type ReviewNotificationInterval =
  (typeof REVIEW_NOTIFICATION_INTERVALS)[number]

export interface ReviewNotificationPreferences {
  enabled: boolean
  intervalMinutes: ReviewNotificationInterval
}

export const DEFAULT_REVIEW_NOTIFICATION_PREFERENCES: ReviewNotificationPreferences =
  {
    enabled: false,
    intervalMinutes: 15,
  }

export interface ReviewNotificationCandidate {
  id: string
  title: string
  url: string
  repositoryFullName: string
  pullNumber: number
  updatedAt: string
}

export interface ReviewNotificationSnapshot {
  initialized: boolean
  activeCandidateIds: string[]
  updatedAt: string | null
}

export const EMPTY_REVIEW_NOTIFICATION_SNAPSHOT: ReviewNotificationSnapshot = {
  initialized: false,
  activeCandidateIds: [],
  updatedAt: null,
}

export interface ReviewNotificationRoute {
  notificationId: string
  url: string
  createdAt: string
}

export interface ReviewNotificationState {
  snapshot: ReviewNotificationSnapshot
  routes: ReviewNotificationRoute[]
}

export type ReviewNotificationSourceErrorCode =
  | 'missing-token'
  | 'unauthorized'
  | 'rate-limited'
  | 'network-error'
  | 'invalid-response'
  | 'unknown-error'

export type ReviewNotificationSourceResult =
  | { status: 'success'; candidates: ReviewNotificationCandidate[] }
  | {
      status: 'error'
      error: {
        code: ReviewNotificationSourceErrorCode
        retryAfterSeconds?: number
      }
    }

export interface ReviewNotificationDelivery {
  notificationId: string
  title: string
  message: string
  url: string | null
  kind: 'review-request' | 'overflow'
}

export interface ReviewNotificationDiff {
  snapshot: ReviewNotificationSnapshot
  deliveries: ReviewNotificationDelivery[]
  newCandidateCount: number
}

export type ReviewNotificationPollOutcome =
  | { status: 'disabled' | 'permission-required' | 'already-running' }
  | { status: 'source-error'; code: ReviewNotificationSourceErrorCode }
  | {
      status: 'success'
      baselineCreated: boolean
      candidateCount: number
      newCandidateCount: number
      deliveryCount: number
    }

export class ReviewNotificationValidationError extends Error {
  readonly code = 'invalid-input' as const

  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message)
    this.name = 'ReviewNotificationValidationError'
  }
}

export const isReviewNotificationInterval = (
  value: number,
): value is ReviewNotificationInterval =>
  REVIEW_NOTIFICATION_INTERVALS.includes(value as ReviewNotificationInterval)

export const normalizeReviewNotificationPreferences = (
  input: ReviewNotificationPreferences,
): ReviewNotificationPreferences => {
  if (typeof input.enabled !== 'boolean') {
    throw new ReviewNotificationValidationError(
      'enabled must be a boolean',
      'enabled',
    )
  }
  if (!isReviewNotificationInterval(input.intervalMinutes)) {
    throw new ReviewNotificationValidationError(
      'intervalMinutes must be a supported interval',
      'intervalMinutes',
    )
  }
  return { enabled: input.enabled, intervalMinutes: input.intervalMinutes }
}

const normalizeCandidateId = (id: string): string => {
  const normalized = id.trim()
  if (normalized.length === 0 || normalized.length > 128) {
    throw new ReviewNotificationValidationError(
      'candidate id must contain 1-128 characters',
      'candidate.id',
    )
  }
  return normalized
}

export const createReviewNotificationDiff = (
  previous: ReviewNotificationSnapshot,
  candidates: readonly ReviewNotificationCandidate[],
  now: string,
): ReviewNotificationDiff => {
  const bounded = candidates.slice(0, MAX_REVIEW_NOTIFICATION_CANDIDATES)
  const uniqueCandidates = new Map<string, ReviewNotificationCandidate>()
  for (const candidate of bounded) {
    uniqueCandidates.set(normalizeCandidateId(candidate.id), candidate)
  }
  const currentCandidates = [...uniqueCandidates.values()].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.id.localeCompare(right.id),
  )
  const snapshot: ReviewNotificationSnapshot = {
    initialized: true,
    activeCandidateIds: currentCandidates.map(({ id }) => id),
    updatedAt: now,
  }
  if (!previous.initialized) {
    return { snapshot, deliveries: [], newCandidateCount: 0 }
  }

  const previousIds = new Set(previous.activeCandidateIds)
  const newCandidates = currentCandidates.filter(
    ({ id }) => !previousIds.has(id),
  )
  const individualCandidates = newCandidates.slice(
    0,
    MAX_REVIEW_NOTIFICATIONS_PER_POLL,
  )
  const deliveries: ReviewNotificationDelivery[] = individualCandidates.map(
    (candidate) => ({
      notificationId: `${REVIEW_NOTIFICATION_ID_PREFIX}${candidate.id}`,
      title: 'Review requested',
      message: `${candidate.repositoryFullName} #${candidate.pullNumber}: ${candidate.title}`,
      url: candidate.url,
      kind: 'review-request',
    }),
  )
  const overflowCount = newCandidates.length - individualCandidates.length
  if (overflowCount > 0) {
    deliveries.push({
      notificationId: `${REVIEW_NOTIFICATION_ID_PREFIX}overflow`,
      title: 'More reviews requested',
      message: `${overflowCount} additional pull requests need your review`,
      url: null,
      kind: 'overflow',
    })
  }
  return {
    snapshot,
    deliveries,
    newCandidateCount: newCandidates.length,
  }
}
