import type {
  ReviewInboxData,
  ReviewInboxErrorCode,
} from '@/modules/pull-requests';

export type ReviewInboxQueryData = ReviewInboxData;

export class ReviewInboxQueryError extends Error {
  constructor(
    public readonly code: ReviewInboxErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ReviewInboxQueryError';
  }
}
