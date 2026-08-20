import type {
  ReviewInboxError,
  ReviewInboxPullRequest,
  ReviewInboxSectionKind,
} from '../domain/ReviewInbox'

export interface ReadReviewInboxSectionInput {
  kind: ReviewInboxSectionKind
  limit: number
}

export type ReviewInboxReadSectionResult =
  | { status: 'success'; items: ReviewInboxPullRequest[] }
  | { status: 'error'; error: ReviewInboxError }

export interface ReviewInboxReader {
  readSection(
    input: ReadReviewInboxSectionInput,
  ): Promise<ReviewInboxReadSectionResult>
}
