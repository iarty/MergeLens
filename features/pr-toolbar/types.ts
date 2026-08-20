import type { LocalReviewController } from '@/features/local-review/types'
import type { ToolbarData, ToolbarErrorCode } from '@/shared/messaging/schemas'

export interface PRToolbarError {
  code: ToolbarErrorCode
  message: string
  retryAfterSeconds?: number
}

export type PRToolbarState =
  | { status: 'loading' }
  | { status: 'unsupported-context' }
  | {
      status: 'success'
      data: ToolbarData
      quickLinksStatus?: 'loading' | 'success' | 'error'
      quickLinksError?: PRToolbarError
    }
  | { status: 'error'; error: PRToolbarError }

export interface PRToolbarProps {
  state: PRToolbarState
  localReviewController?: LocalReviewController
  isLocalReviewOpen?: boolean
  onOpenSettings?: () => void
  onRetry?: () => void
  onToggleLocalReview?: () => void
}
