import type {
  ReviewInboxData,
  ReviewInboxPullRequest,
} from '@/modules/pull-requests';

export const createReviewInboxItem = (
  overrides: Partial<ReviewInboxPullRequest> = {},
): ReviewInboxPullRequest => ({
  id: '101',
  number: 101,
  title: 'Improve concurrent rendering behavior',
  url: 'https://github.com/facebook/react/pull/101',
  repository: {
    owner: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    url: 'https://github.com/facebook/react',
  },
  authorLogin: 'react-contributor',
  isDraft: false,
  updatedAt: '2026-08-13T02:00:00Z',
  reasons: ['review-requested', 'assigned'],
  ...overrides,
});

export const createReviewInboxData = (
  item: ReviewInboxPullRequest = createReviewInboxItem(),
): ReviewInboxData => ({
  reviewRequests: { status: 'success', items: [item] },
  assigned: { status: 'success', items: [item] },
  recentActivity: {
    status: 'success',
    items: [
      createReviewInboxItem({
        id: '202',
        number: 202,
        title: 'Refine React developer warnings',
        url: 'https://github.com/facebook/react/pull/202',
        reasons: ['recent-activity'],
      }),
    ],
  },
});
