import { describe, expect, it } from 'vitest'
import {
  EMPTY_REVIEW_NOTIFICATION_SNAPSHOT,
  MAX_REVIEW_NOTIFICATION_CANDIDATES,
  createReviewNotificationDiff,
  normalizeReviewNotificationPreferences,
  type ReviewNotificationCandidate,
} from '@/modules/review-notifications/domain/ReviewNotification'

const candidate = (index: number): ReviewNotificationCandidate => ({
  id: `candidate-${index}`,
  title: `Title ${index}`,
  url: `https://github.com/acme/repo/pull/${index}`,
  repositoryFullName: 'acme/repo',
  pullNumber: index,
  updatedAt: `2026-08-18T10:${index.toString().padStart(2, '0')}:00.000Z`,
})

describe('review notification domain', () => {
  it('creates a silent bounded baseline on the first successful snapshot', () => {
    const candidates = Array.from(
      { length: MAX_REVIEW_NOTIFICATION_CANDIDATES + 10 },
      (_, index) => candidate(index),
    )

    const result = createReviewNotificationDiff(
      EMPTY_REVIEW_NOTIFICATION_SNAPSHOT,
      candidates,
      '2026-08-18T12:00:00.000Z',
    )

    expect(result.deliveries).toEqual([])
    expect(result.newCandidateCount).toBe(0)
    expect(result.snapshot.initialized).toBe(true)
    expect(result.snapshot.activeCandidateIds).toHaveLength(
      MAX_REVIEW_NOTIFICATION_CANDIDATES,
    )
  })

  it('notifies only newly entered candidates and aggregates overflow', () => {
    const result = createReviewNotificationDiff(
      {
        initialized: true,
        activeCandidateIds: ['candidate-0'],
        updatedAt: '2026-08-18T09:00:00.000Z',
      },
      [candidate(0), candidate(1), candidate(2), candidate(3), candidate(4)],
      '2026-08-18T12:00:00.000Z',
    )

    expect(result.newCandidateCount).toBe(4)
    expect(result.deliveries).toHaveLength(4)
    expect(result.deliveries.map(({ kind }) => kind)).toEqual([
      'review-request',
      'review-request',
      'review-request',
      'overflow',
    ])
    expect(result.deliveries.at(-1)).toMatchObject({
      url: null,
      message: '1 additional pull requests need your review',
    })
  })

  it('deduplicates candidate IDs and rejects unsupported intervals', () => {
    const result = createReviewNotificationDiff(
      { initialized: true, activeCandidateIds: [], updatedAt: null },
      [candidate(1), { ...candidate(1), title: 'Updated title' }],
      '2026-08-18T12:00:00.000Z',
    )

    expect(result.snapshot.activeCandidateIds).toEqual(['candidate-1'])
    expect(result.newCandidateCount).toBe(1)
    expect(() =>
      normalizeReviewNotificationPreferences({
        enabled: true,
        intervalMinutes: 1 as 5,
      }),
    ).toThrow(/supported interval/)
  })
})
