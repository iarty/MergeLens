export type ReviewInboxReason =
  'review-requested' | 'assigned' | 'recent-activity'

export interface ReviewInboxRepository {
  owner: string
  name: string
  fullName: string
  url: string
}

export interface ReviewInboxPullRequest {
  id: string
  number: number
  title: string
  url: string
  repository: ReviewInboxRepository
  authorLogin: string | null
  isDraft: boolean
  updatedAt: string
  reasons: ReviewInboxReason[]
}

export type ReviewInboxSectionKind =
  'review-requests' | 'assigned' | 'recent-activity'

export type ReviewInboxErrorCode =
  | 'invalid-request'
  | 'missing-token'
  | 'unauthorized'
  | 'rate-limited'
  | 'network-error'
  | 'invalid-response'
  | 'receiver-unavailable'
  | 'unknown-error'

export interface ReviewInboxError {
  code: ReviewInboxErrorCode
  message: string
  retryAfterSeconds?: number
}

export type ReviewInboxSectionResult =
  | { status: 'success'; items: ReviewInboxPullRequest[] }
  | { status: 'error'; error: ReviewInboxError }

export interface ReviewInboxData {
  reviewRequests: ReviewInboxSectionResult
  assigned: ReviewInboxSectionResult
  recentActivity: ReviewInboxSectionResult
}
