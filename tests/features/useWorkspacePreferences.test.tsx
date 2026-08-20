import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useWorkspacePreferences,
  WORKSPACE_PREFERENCES_QUERY_KEY,
} from '@/features/review-inbox/useWorkspacePreferences'
import {
  getEffectiveWorkspacePreferences,
  listSavedFilters,
  subscribeWorkspacePreferences,
  type SavedInboxFilter,
} from '@/modules/workspace-preferences'

vi.mock('@/modules/workspace-preferences', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/modules/workspace-preferences')>()
  return {
    ...original,
    getEffectiveWorkspacePreferences: vi.fn(),
    listSavedFilters: vi.fn(),
    subscribeWorkspacePreferences: vi.fn(),
  }
})

const savedFilter: SavedInboxFilter = {
  id: 'react-reviews',
  name: 'React reviews',
  view: 'reviewRequests',
  criteria: {
    repositories: ['facebook/react'],
    authors: [],
    draftState: 'any',
  },
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useWorkspacePreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listSavedFilters).mockResolvedValue({
      status: 'success',
      data: [savedFilter],
    })
    vi.mocked(getEffectiveWorkspacePreferences).mockResolvedValue({
      preferences: {
        featureFlags: {
          savedFilters: true,
          customCommandPaletteShortcut: true,
        },
        commandPaletteShortcut: 'primary-k',
      },
      repositoryKey: null,
      source: 'default',
    })
    vi.mocked(subscribeWorkspacePreferences).mockReturnValue(vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads saved filters and tracks an active selection', async () => {
    const { result } = renderHook(() => useWorkspacePreferences(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.savedFilters).toEqual([savedFilter])
    expect(result.current.hasLoadError).toBe(false)
    expect(WORKSPACE_PREFERENCES_QUERY_KEY).toEqual([
      'workspace-preferences',
      'saved-filters',
    ])

    act(() => result.current.selectFilter('react-reviews'))
    expect(result.current.activeFilter).toEqual(savedFilter)
  })

  it('falls back to an unfiltered state after a recoverable storage error', async () => {
    vi.mocked(listSavedFilters).mockResolvedValue({
      status: 'error',
      error: {
        code: 'storage-unavailable',
        message: 'Storage unavailable',
      },
    })
    const { result } = renderHook(() => useWorkspacePreferences(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.savedFilters).toEqual([])
    expect(result.current.hasLoadError).toBe(true)
    expect(result.current.activeFilter).toBeNull()
  })

  it('clears the active filter after a refetch no longer returns it', async () => {
    vi.mocked(listSavedFilters)
      .mockResolvedValueOnce({ status: 'success', data: [savedFilter] })
      .mockResolvedValueOnce({ status: 'success', data: [] })
    const { result } = renderHook(() => useWorkspacePreferences(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.savedFilters).toHaveLength(1))

    act(() => result.current.selectFilter('react-reviews'))
    expect(result.current.activeFilterId).toBe('react-reviews')
    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() => expect(result.current.activeFilterId).toBeNull())
    expect(result.current.savedFilters).toEqual([])
  })

  it('applies repository flags and refreshes after a storage notification', async () => {
    const unsubscribe = vi.fn()
    vi.stubGlobal('browser', {})
    vi.mocked(subscribeWorkspacePreferences).mockReturnValue(unsubscribe)
    vi.mocked(getEffectiveWorkspacePreferences)
      .mockResolvedValueOnce({
        preferences: {
          featureFlags: {
            savedFilters: false,
            customCommandPaletteShortcut: true,
          },
          commandPaletteShortcut: 'primary-shift-p',
        },
        repositoryKey: 'facebook/react',
        source: 'repository',
      })
      .mockResolvedValueOnce({
        preferences: {
          featureFlags: {
            savedFilters: true,
            customCommandPaletteShortcut: false,
          },
          commandPaletteShortcut: 'primary-shift-p',
        },
        repositoryKey: 'facebook/react',
        source: 'repository',
      })
    const { result, unmount } = renderHook(
      () => useWorkspacePreferences('facebook/react'),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.savedFiltersEnabled).toBe(false)
    expect(result.current.savedFilters).toEqual([])
    expect(result.current.commandPaletteShortcut).toBe('primary-shift-p')
    expect(getEffectiveWorkspacePreferences).toHaveBeenCalledWith(
      'facebook/react',
    )

    const notify = vi.mocked(subscribeWorkspacePreferences).mock.calls[0]?.[0]
    act(() => notify?.('global'))
    await waitFor(() => {
      expect(result.current.savedFiltersEnabled).toBe(true)
      expect(result.current.commandPaletteShortcut).toBe('primary-k')
    })

    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
