import { describe, expect, it } from 'vitest'
import { mapQuickLinksResponse } from '@/modules/quick-links/adapters/mapQuickLinksResponse'

describe('mapQuickLinksResponse', () => {
  it('maps deployment status and preserves configured links', () => {
    const statuses = new Map([
      [
        '1',
        [
          {
            state: 'success',
            environment_url: 'https://preview.example.com',
            updated_at: '2026-08-14T01:00:00Z',
          },
        ],
      ],
    ])
    const result = mapQuickLinksResponse(
      [
        {
          id: 1,
          environment: 'Preview',
          sha: 'abc',
          statuses_url: 'https://api.github.com/statuses/1',
        },
      ],
      statuses,
      [{ id: 'docs', label: 'Docs', url: 'https://docs.example.com/' }],
    )

    expect(result).toEqual({
      deployments: [
        {
          id: '1',
          environment: 'Preview',
          state: 'success',
          url: 'https://preview.example.com',
          updatedAt: '2026-08-14T01:00:00Z',
        },
      ],
      configuredLinks: [
        { id: 'docs', label: 'Docs', url: 'https://docs.example.com/' },
      ],
    })
  })

  it('uses stable fallbacks and rejects unsafe status URLs', () => {
    expect(
      mapQuickLinksResponse(
        [
          {
            id: 2,
            environment: '',
            sha: 'def',
            statuses_url: 'https://api.github.com/statuses/2',
          },
        ],
        new Map(),
        [],
      ).deployments[0],
    ).toMatchObject({ environment: 'Deployment', state: 'unknown', url: null })

    expect(() =>
      mapQuickLinksResponse(
        [
          {
            id: 3,
            environment: 'Preview',
            sha: 'ghi',
            statuses_url: 'https://api.github.com/statuses/3',
          },
        ],
        new Map([
          ['3', [{ state: 'success', environment_url: 'javascript:alert(1)' }]],
        ]),
        [],
      ),
    ).toThrow()
  })
})
