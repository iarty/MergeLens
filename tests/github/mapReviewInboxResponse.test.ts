import { describe, expect, it } from 'vitest'
import { mapReviewInboxSearchItem } from '@/modules/pull-requests/adapters/mapReviewInboxResponse'

const searchItem = {
  id: 42,
  number: 123,
  title: 'Improve concurrent rendering',
  html_url: 'https://github.com/facebook/react/pull/123',
  repository_url: 'https://api.github.com/repos/facebook/react',
  user: { login: 'react-contributor' },
  draft: true,
  updated_at: '2026-08-13T02:00:00Z',
  pull_request: {
    url: 'https://api.github.com/repos/facebook/react/pulls/123',
  },
}

describe('mapReviewInboxSearchItem', () => {
  it('normalizes a public GitHub search result', () => {
    expect(mapReviewInboxSearchItem(searchItem, 'review-requests')).toEqual({
      id: '42',
      number: 123,
      title: 'Improve concurrent rendering',
      url: 'https://github.com/facebook/react/pull/123',
      repository: {
        owner: 'facebook',
        name: 'react',
        fullName: 'facebook/react',
        url: 'https://github.com/facebook/react',
      },
      authorLogin: 'react-contributor',
      isDraft: true,
      updatedAt: '2026-08-13T02:00:00Z',
      reasons: ['review-requested'],
    })
  })

  it('rejects malformed repository URLs and non-PR results', () => {
    expect(() =>
      mapReviewInboxSearchItem(
        { ...searchItem, repository_url: 'https://example.com/facebook/react' },
        'assigned',
      ),
    ).toThrow()
    expect(() =>
      mapReviewInboxSearchItem(
        { ...searchItem, pull_request: undefined },
        'assigned',
      ),
    ).toThrow()
  })
})
