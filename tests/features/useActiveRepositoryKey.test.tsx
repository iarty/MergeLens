import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useActiveRepositoryKey } from '@/features/review-inbox/useActiveRepositoryKey'

describe('useActiveRepositoryKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('derives a canonical key from the active GitHub repository tab', async () => {
    vi.stubGlobal('browser', {
      tabs: {
        query: vi
          .fn()
          .mockResolvedValue([
            { url: 'https://github.com/Facebook/React/pull/42' },
          ]),
      },
    })

    const { result } = renderHook(() => useActiveRepositoryKey())

    await waitFor(() => expect(result.current).toBe('facebook/react'))
  })

  it('uses global preferences outside a repository context', async () => {
    vi.stubGlobal('browser', {
      tabs: {
        query: vi
          .fn()
          .mockResolvedValue([{ url: 'https://github.com/settings/profile' }]),
      },
    })

    const { result } = renderHook(() => useActiveRepositoryKey())

    await waitFor(() => {
      expect(result.current).toBeNull()
      expect(browser.tabs.query).toHaveBeenCalledOnce()
    })
  })
})
