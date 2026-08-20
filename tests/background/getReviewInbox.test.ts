import { describe, expect, it, vi } from 'vitest'
import { createGetReviewInbox } from '@/modules/pull-requests'
import type {
  ReviewInboxPullRequest,
  ReviewInboxReader,
  ReviewInboxReadSectionResult,
} from '@/modules/pull-requests'

vi.mock('@/shared/github/auth/localToken', () => ({
  readLocalGitHubToken: vi.fn(),
}))

const createItem = (
  number: number,
  reasons: ReviewInboxPullRequest['reasons'],
): ReviewInboxPullRequest => ({
  id: String(number),
  number,
  title: `React pull request ${number}`,
  url: `https://github.com/facebook/react/pull/${number}`,
  repository: {
    owner: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    url: 'https://github.com/facebook/react',
  },
  authorLogin: 'react-contributor',
  isDraft: false,
  updatedAt: '2026-08-13T02:00:00Z',
  reasons,
})

const createReader = (
  results: Record<
    'review-requests' | 'assigned' | 'recent-activity',
    ReviewInboxReadSectionResult
  >,
): ReviewInboxReader => ({
  readSection: vi.fn<ReviewInboxReader['readSection']>(
    async ({ kind }) => results[kind],
  ),
})

describe('getReviewInbox', () => {
  it('deduplicates priority PRs and excludes them from recent activity', async () => {
    const reader = createReader({
      'review-requests': {
        status: 'success',
        items: [createItem(1, ['review-requested'])],
      },
      assigned: {
        status: 'success',
        items: [createItem(1, ['assigned']), createItem(2, ['assigned'])],
      },
      'recent-activity': {
        status: 'success',
        items: [
          createItem(1, ['recent-activity']),
          createItem(3, ['recent-activity']),
        ],
      },
    })
    const getReviewInbox = createGetReviewInbox(reader)

    const response = await getReviewInbox({ correlationId: 'inbox-1' })

    expect(response).toMatchObject({ status: 'success' })
    if (response.status !== 'success') {
      throw new Error('Expected review inbox success')
    }
    expect(response.data.reviewRequests).toMatchObject({
      status: 'success',
      items: [{ number: 1, reasons: ['review-requested', 'assigned'] }],
    })
    expect(response.data.assigned).toMatchObject({
      status: 'success',
      items: [
        { number: 1, reasons: ['review-requested', 'assigned'] },
        { number: 2, reasons: ['assigned'] },
      ],
    })
    expect(response.data.recentActivity).toMatchObject({
      status: 'success',
      items: [{ number: 3 }],
    })
  })

  it('preserves successful sections when one section fails', async () => {
    const reader = createReader({
      'review-requests': { status: 'success', items: [] },
      assigned: {
        status: 'error',
        error: { code: 'rate-limited', message: 'Try later' },
      },
      'recent-activity': { status: 'success', items: [] },
    })

    await expect(
      createGetReviewInbox(reader)({ correlationId: 'inbox-2' }),
    ).resolves.toMatchObject({
      status: 'success',
      data: {
        reviewRequests: { status: 'success' },
        assigned: { status: 'error', error: { code: 'rate-limited' } },
        recentActivity: { status: 'success' },
      },
    })
  })

  it('rejects malformed input before calling the reader', async () => {
    const reader = createReader({
      'review-requests': { status: 'success', items: [] },
      assigned: { status: 'success', items: [] },
      'recent-activity': { status: 'success', items: [] },
    })

    await expect(
      createGetReviewInbox(reader)({ correlationId: '' }),
    ).resolves.toMatchObject({
      status: 'error',
      correlationId: 'invalid-request',
      error: { code: 'invalid-request' },
    })
    expect(reader.readSection).not.toHaveBeenCalled()
  })

  it('contains unexpected reader failures', async () => {
    const reader: ReviewInboxReader = {
      readSection: vi.fn().mockRejectedValue(new Error('Unexpected failure')),
    }

    await expect(
      createGetReviewInbox(reader)({ correlationId: 'inbox-3' }),
    ).resolves.toMatchObject({
      status: 'error',
      correlationId: 'inbox-3',
      error: { code: 'unknown-error' },
    })
  })
})
