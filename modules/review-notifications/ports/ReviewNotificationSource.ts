import type { ReviewNotificationSourceResult } from '../domain/ReviewNotification';

export interface ReviewNotificationSource {
  listReviewRequests(): Promise<ReviewNotificationSourceResult>;
}
