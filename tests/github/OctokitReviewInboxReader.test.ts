import { describe, expect, it, vi } from 'vitest'
import { OctokitReviewInboxReader } from '@/modules/pull-requests'

vi.mock('@/shared/github/auth/localToken', () => ({
  readLocalGitHubToken: vi.fn(),
}))

const searchItem = {
  id: 42,
  number: 123,
  title: 'Improve concurrent rendering',
  html_url: 'https://github.com/facebook/react/pull/123',
  repository_url: 'https://api.github.com/repos/facebook/react',
  user: { login: 'react-contributor' },
  draft: false,
  updated_at: '2026-08-13T02:00:00Z',
  pull_request: {
    url: 'https://api.github.com/repos/facebook/react/pulls/123',
  },
}

type SearchInput = {
  q: string
  sort: 'updated'
  order: 'desc'
  per_page: number
  page: number
}

type SearchResponse = {
  data: { items: unknown[] }
  headers: Record<string, string | number | undefined>
}

type SearchFunction = (input: SearchInput) => Promise<SearchResponse>

const createClient = (issuesAndPullRequests: SearchFunction) => () => ({
  rest: { search: { issuesAndPullRequests } },
})

describe('OctokitReviewInboxReader', () => {
  it.each([
    ['review-requests', 'is:pr is:open review-requested:@me'],
    ['assigned', 'is:pr is:open assignee:@me'],
    ['recent-activity', 'is:pr is:open involves:@me'],
  ] as const)('loads the bounded %s query', async (kind, query) => {
    const search = vi.fn<SearchFunction>().mockResolvedValue({
      data: { items: [searchItem] },
      headers: { 'x-ratelimit-remaining': '29' },
    })
    const reader = new OctokitReviewInboxReader(
      vi.fn().mockResolvedValue('fixture-token'),
      createClient(search),
    )

    const result = await reader.readSection({ kind, limit: 100 })

    expect(result).toMatchObject({ status: 'success' })
    expect(search).toHaveBeenCalledWith({
      q: query,
      sort: 'updated',
      order: 'desc',
      per_page: 20,
      page: 1,
    })
  })

  it('returns missing-token without creating a client', async () => {
    const clientFactory = vi.fn()
    const reader = new OctokitReviewInboxReader(
      vi.fn().mockResolvedValue(null),
      clientFactory,
    )

    await expect(
      reader.readSection({ kind: 'assigned', limit: 10 }),
    ).resolves.toEqual({
      status: 'error',
      error: {
        code: 'missing-token',
        message: 'GitHub token is not configured',
      },
    })
    expect(clientFactory).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'rate-limited'],
    [503, 'network-error'],
  ] as const)('maps GitHub status %s to %s', async (status, code) => {
    const error = Object.assign(new Error('GitHub failure'), {
      status,
      response: { headers: { 'retry-after': '30' } },
    })
    const search = vi.fn<SearchFunction>().mockRejectedValue(error)
    const reader = new OctokitReviewInboxReader(
      vi.fn().mockResolvedValue('fixture-token'),
      createClient(search),
    )

    const result = await reader.readSection({
      kind: 'recent-activity',
      limit: 10,
    })

    expect(result).toMatchObject({ status: 'error', error: { code } })
    if (status === 403) {
      expect(result).toMatchObject({ error: { retryAfterSeconds: 30 } })
    }
  })

  it('rejects malformed search payloads as invalid-response', async () => {
    const search = vi.fn<SearchFunction>().mockResolvedValue({
      data: { items: [{ ...searchItem, number: 0 }] },
      headers: {},
    })
    const reader = new OctokitReviewInboxReader(
      vi.fn().mockResolvedValue('fixture-token'),
      createClient(search),
    )

    await expect(
      reader.readSection({ kind: 'review-requests', limit: 10 }),
    ).resolves.toMatchObject({
      status: 'error',
      error: { code: 'invalid-response' },
    })
  })
})
