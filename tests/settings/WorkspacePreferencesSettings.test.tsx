import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspacePreferencesSettings } from '@/features/settings/WorkspacePreferencesSettings'
import {
  deleteSavedFilter,
  getWorkspacePreferences,
  updateWorkspacePreferences,
  upsertSavedFilter,
  type SavedInboxFilter,
  type WorkspacePreferencesState,
} from '@/modules/workspace-preferences'

vi.mock('@/modules/workspace-preferences', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/modules/workspace-preferences')>()
  return {
    ...original,
    deleteSavedFilter: vi.fn(),
    getWorkspacePreferences: vi.fn(),
    updateWorkspacePreferences: vi.fn(),
    upsertSavedFilter: vi.fn(),
  }
})

const alphaFilter: SavedInboxFilter = {
  id: 'alpha-filter',
  name: 'Alpha reviews',
  view: 'reviewRequests',
  criteria: {
    repositories: ['acme/api'],
    authors: ['octocat'],
    draftState: 'ready',
  },
}

const emptyState: WorkspacePreferencesState = {
  savedFilters: [],
  globalPreferences: {},
  repositoryPreferences: [],
}

const successState = (state: WorkspacePreferencesState = emptyState) => ({
  status: 'success' as const,
  data: state,
})

describe('WorkspacePreferencesSettings', () => {
  beforeEach(() => {
    vi.mocked(getWorkspacePreferences).mockResolvedValue(successState())
    vi.mocked(upsertSavedFilter).mockResolvedValue({
      status: 'success',
      data: { filter: alphaFilter, filters: [alphaFilter] },
    })
    vi.mocked(deleteSavedFilter).mockResolvedValue({
      status: 'success',
      data: [],
    })
    vi.mocked(updateWorkspacePreferences).mockResolvedValue({
      status: 'success',
      data: { globalPreferences: {}, repositoryPreferences: [] },
    })
  })

  it('renders accessible loading and empty states', async () => {
    let resolveLoad:
      ((value: ReturnType<typeof successState>) => void) | undefined
    vi.mocked(getWorkspacePreferences).mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve
      }),
    )

    render(<WorkspacePreferencesSettings />)

    expect(
      screen.getByRole('region', { name: 'Workspace preferences' }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading workspace preferences',
    )
    expect(screen.getByLabelText('Name')).toBeDisabled()

    resolveLoad?.(successState())

    expect(await screen.findByText('No saved filters yet.')).toBeVisible()
    expect(screen.getByText('No repository overrides.')).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Workspace preferences' }),
    ).toHaveAttribute('aria-busy', 'false')
  })

  it('adds, edits, and deletes saved filters through the public API', async () => {
    vi.mocked(getWorkspacePreferences).mockResolvedValue(
      successState({ ...emptyState, savedFilters: [alphaFilter] }),
    )
    vi.mocked(upsertSavedFilter).mockResolvedValue({
      status: 'success',
      data: {
        filter: { ...alphaFilter, name: 'Updated reviews' },
        filters: [{ ...alphaFilter, name: 'Updated reviews' }],
      },
    })

    render(<WorkspacePreferencesSettings />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit Alpha reviews' }),
    )
    expect(screen.getByLabelText('Name')).toHaveValue('Alpha reviews')
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Updated reviews' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }))

    await waitFor(() => {
      expect(upsertSavedFilter).toHaveBeenCalledWith({
        filter: {
          id: 'alpha-filter',
          name: 'Updated reviews',
          view: 'reviewRequests',
          criteria: {
            repositories: ['acme/api'],
            authors: ['octocat'],
            draftState: 'ready',
          },
        },
      })
    })
    expect(await screen.findByText('Updated reviews')).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Updated reviews' }),
    )
    await waitFor(() => {
      expect(deleteSavedFilter).toHaveBeenCalledWith({
        filterId: 'alpha-filter',
      })
    })
    expect(await screen.findByText('No saved filters yet.')).toBeVisible()
  })

  it('creates a normalized saved filter from comma-separated criteria', async () => {
    render(<WorkspacePreferencesSettings />)
    await screen.findByText('No saved filters yet.')

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Team queue' },
    })
    fireEvent.change(screen.getByLabelText('Inbox view'), {
      target: { value: 'assigned' },
    })
    fireEvent.change(screen.getByLabelText('Repositories'), {
      target: { value: 'Acme/API, acme/web' },
    })
    fireEvent.change(screen.getByLabelText('Authors'), {
      target: { value: '@Octocat, monalisa' },
    })
    fireEvent.change(screen.getByLabelText('Draft state'), {
      target: { value: 'draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }))

    await waitFor(() => {
      expect(upsertSavedFilter).toHaveBeenCalledWith({
        filter: {
          id: undefined,
          name: 'Team queue',
          view: 'assigned',
          criteria: {
            repositories: ['Acme/API', 'acme/web'],
            authors: ['@Octocat', 'monalisa'],
            draftState: 'draft',
          },
        },
      })
    })
  })

  it('updates global feature flags and shortcut choices', async () => {
    vi.mocked(updateWorkspacePreferences)
      .mockResolvedValueOnce({
        status: 'success',
        data: {
          globalPreferences: {
            featureFlags: {
              savedFilters: false,
              customCommandPaletteShortcut: true,
            },
          },
          repositoryPreferences: [],
        },
      })
      .mockResolvedValueOnce({
        status: 'success',
        data: {
          globalPreferences: {
            featureFlags: {
              savedFilters: false,
              customCommandPaletteShortcut: true,
            },
            commandPaletteShortcut: 'primary-shift-p',
          },
          repositoryPreferences: [],
        },
      })
    render(<WorkspacePreferencesSettings />)
    await screen.findByText('No saved filters yet.')

    fireEvent.click(screen.getByRole('checkbox', { name: /Saved filters/ }))
    await waitFor(() => {
      expect(updateWorkspacePreferences).toHaveBeenCalledWith({
        kind: 'global',
        preferences: {
          featureFlags: {
            savedFilters: false,
            customCommandPaletteShortcut: true,
          },
        },
      })
    })

    fireEvent.change(screen.getByLabelText('Command palette shortcut'), {
      target: { value: 'primary-shift-p' },
    })
    await waitFor(() => {
      expect(updateWorkspacePreferences).toHaveBeenLastCalledWith({
        kind: 'global',
        preferences: {
          featureFlags: {
            savedFilters: false,
            customCommandPaletteShortcut: true,
          },
          commandPaletteShortcut: 'primary-shift-p',
        },
      })
    })
  })

  it('adds, edits, and deletes repository overrides', async () => {
    const override = {
      repositoryKey: 'acme/api',
      featureFlags: { savedFilters: false },
    }
    vi.mocked(updateWorkspacePreferences)
      .mockResolvedValueOnce({
        status: 'success',
        data: { globalPreferences: {}, repositoryPreferences: [override] },
      })
      .mockResolvedValueOnce({
        status: 'success',
        data: { globalPreferences: {}, repositoryPreferences: [] },
      })
    render(<WorkspacePreferencesSettings />)
    await screen.findByText('No repository overrides.')

    fireEvent.change(screen.getByLabelText('Repository'), {
      target: { value: 'ACME/API' },
    })
    fireEvent.change(
      screen.getByLabelText('Saved filters', { selector: 'select' }),
      {
        target: { value: 'disabled' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add override' }))

    await waitFor(() => {
      expect(updateWorkspacePreferences).toHaveBeenCalledWith({
        kind: 'repository-upsert',
        preferences: {
          repositoryKey: 'acme/api',
          featureFlags: { savedFilters: false },
        },
      })
    })
    expect(await screen.findByText('acme/api')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Edit acme/api' }))
    expect(screen.getByLabelText('Repository')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }))

    fireEvent.click(screen.getByRole('button', { name: 'Delete acme/api' }))
    await waitFor(() => {
      expect(updateWorkspacePreferences).toHaveBeenLastCalledWith({
        kind: 'repository-delete',
        repositoryKey: 'acme/api',
      })
    })
    expect(await screen.findByText('No repository overrides.')).toBeVisible()
  })

  it('rejects invalid local input without calling storage mutations', async () => {
    render(<WorkspacePreferencesSettings />)
    await screen.findByText('No saved filters yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a unique name')
    expect(upsertSavedFilter).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Repository'), {
      target: { value: 'not-a-repository' },
    })
    fireEvent.change(
      screen.getByLabelText('Saved filters', { selector: 'select' }),
      {
        target: { value: 'enabled' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add override' }))
    expect(screen.getByRole('alert')).toHaveTextContent('owner/repository')
    expect(updateWorkspacePreferences).not.toHaveBeenCalled()
  })

  it('keeps the form usable after an expected mutation failure', async () => {
    vi.mocked(upsertSavedFilter).mockResolvedValue({
      status: 'error',
      error: {
        code: 'quota-exceeded',
        message: 'Quota exceeded',
      },
    })
    render(<WorkspacePreferencesSettings />)
    await screen.findByText('No saved filters yet.')

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Team queue' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sync storage is full',
    )
    expect(screen.getByLabelText('Name')).toHaveValue('Team queue')
    expect(screen.getByRole('button', { name: 'Add filter' })).toBeEnabled()
    expect(screen.getByText('No saved filters yet.')).toBeVisible()
  })

  it('shows a recoverable storage error and retries loading', async () => {
    vi.mocked(getWorkspacePreferences)
      .mockResolvedValueOnce({
        status: 'error',
        error: { code: 'storage-unavailable', message: 'Unavailable' },
      })
      .mockResolvedValueOnce(
        successState({ ...emptyState, savedFilters: [alphaFilter] }),
      )
    render(<WorkspacePreferencesSettings />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Workspace preferences are unavailable')
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByRole('button', { name: 'Edit Alpha reviews' }),
    ).toBeVisible()
    expect(getWorkspacePreferences).toHaveBeenCalledTimes(2)
  })
})
