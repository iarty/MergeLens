import type {
  ReviewNotificationPreferences,
  ReviewNotificationRoute,
  ReviewNotificationSnapshot,
} from '../domain/ReviewNotification'

export interface ReviewNotificationStateRepository {
  getPreferences(): Promise<ReviewNotificationPreferences>
  savePreferences(
    preferences: ReviewNotificationPreferences,
  ): Promise<ReviewNotificationPreferences>
  getSnapshot(): Promise<ReviewNotificationSnapshot>
  saveSnapshot(snapshot: ReviewNotificationSnapshot): Promise<void>
  listRoutes(): Promise<ReviewNotificationRoute[]>
  saveRoutes(routes: ReviewNotificationRoute[]): Promise<void>
  subscribePreferences(listener: () => void): () => void
}
