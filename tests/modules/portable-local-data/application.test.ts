import { describe, expect, it, vi } from 'vitest'
vi.mock('wxt/utils/storage', () => ({
  storage: {
    defineItem: (_key: string, options: Record<string, unknown>) => ({
      getValue: vi.fn(async () => options.fallback),
      setValue: vi.fn(async () => undefined),
      watch: vi.fn(() => vi.fn()),
    }),
  },
}))
import {
  createApplyPortableLocalDataImport,
  createExportPortableLocalData,
  createPreviewPortableLocalDataImport,
  type ImportPortableLocalDataDependencies,
} from '@/modules/portable-local-data'
import type {
  LocalReviewRepository,
  PullRequestNote,
  ReviewTemplate,
} from '@/modules/local-review'
import type { ReviewNotificationStateRepository } from '@/modules/review-notifications'
import type { WorkspacePreferencesRepository } from '@/modules/workspace-preferences'

const note: PullRequestNote = {
  prKey: 'acme/api#2',
  owner: 'acme',
  repository: 'api',
  pullNumber: 2,
  body: 'Local note',
  updatedAt: '2026-08-19T09:00:00.000Z',
}
const template: ReviewTemplate = {
  id: 'template-1',
  title: 'Review',
  body: 'Check tests',
  createdAt: '2026-08-18T09:00:00.000Z',
  updatedAt: '2026-08-19T09:00:00.000Z',
}
const filter = {
  id: 'filter-1',
  name: 'Queue',
  view: 'reviewRequests' as const,
  criteria: {
    repositories: ['acme/api'],
    authors: [],
    draftState: 'ready' as const,
  },
}
const repositoryPreferences = {
  repositoryKey: 'acme/api',
  featureFlags: { savedFilters: true },
}
const notificationPreferences = { enabled: true, intervalMinutes: 30 as const }

const createDependencies = (
  overrides: Partial<ImportPortableLocalDataDependencies> = {},
): ImportPortableLocalDataDependencies => ({
  localReviewRepository: {
    readNote: vi.fn(async () => note),
    saveNote: vi.fn(async (value) => value),
    deleteNote: vi.fn(),
    listNotes: vi.fn(async () => [note]),
    listTemplates: vi.fn(async () => [template]),
    upsertTemplate: vi.fn(async (value) => value),
    deleteTemplate: vi.fn(),
  } satisfies LocalReviewRepository,
  workspacePreferencesRepository: {
    listSavedFilters: vi.fn(async () => [filter]),
    upsertSavedFilter: vi.fn(async () => [filter]),
    deleteSavedFilter: vi.fn(),
    getGlobalPreferences: vi.fn(async () => ({
      featureFlags: { savedFilters: true },
    })),
    saveGlobalPreferences: vi.fn(async (value) => value),
    listRepositoryPreferences: vi.fn(async () => [repositoryPreferences]),
    getRepositoryPreferences: vi.fn(async () => repositoryPreferences),
    upsertRepositoryPreferences: vi.fn(async () => [repositoryPreferences]),
    deleteRepositoryPreferences: vi.fn(),
  } satisfies WorkspacePreferencesRepository,
  reviewNotificationRepository: {
    getPreferences: vi.fn(async () => notificationPreferences),
    savePreferences: vi.fn(async (value) => value),
    getSnapshot: vi.fn(),
    saveSnapshot: vi.fn(),
    listRoutes: vi.fn(),
    saveRoutes: vi.fn(),
    subscribePreferences: vi.fn(() => vi.fn()),
  } satisfies ReviewNotificationStateRepository,
  ...overrides,
})

const createEmptyDependencies = (): ImportPortableLocalDataDependencies => {
  const dependencies = createDependencies()
  vi.mocked(dependencies.localReviewRepository.listNotes).mockResolvedValue([])
  vi.mocked(dependencies.localReviewRepository.listTemplates).mockResolvedValue(
    [],
  )
  vi.mocked(
    dependencies.workspacePreferencesRepository.listSavedFilters,
  ).mockResolvedValue([])
  vi.mocked(
    dependencies.workspacePreferencesRepository.getGlobalPreferences,
  ).mockResolvedValue({})
  vi.mocked(
    dependencies.workspacePreferencesRepository.listRepositoryPreferences,
  ).mockResolvedValue([])
  vi.mocked(
    dependencies.reviewNotificationRepository.getPreferences,
  ).mockResolvedValue({ enabled: false, intervalMinutes: 15 })
  return dependencies
}

const createSerializedData = async (
  dependencies: ImportPortableLocalDataDependencies,
): Promise<string> => {
  const result = await createExportPortableLocalData({
    ...dependencies,
    now: () => new Date('2026-08-19T10:00:00.000Z'),
  })()
  if (result.status === 'error') throw new Error(result.error.message)
  return result.serializedData
}

describe('portable local data application', () => {
  it('exports a deterministic payload and imports it as a round trip', async () => {
    const source = createDependencies()
    const serializedData = await createSerializedData(source)
    const target = createEmptyDependencies()
    const preview =
      await createPreviewPortableLocalDataImport(target)(serializedData)
    expect(preview.status).toBe('success')
    if (preview.status === 'error') return
    expect(preview.preview.conflicts.map(({ category }) => category)).toEqual([
      'globalWorkspacePreferences',
      'reviewNotificationPreferences',
    ])
    const applied = await createApplyPortableLocalDataImport(target)({
      preview: preview.preview,
      conflictDecisions: {
        globalWorkspacePreferences: 'use-imported',
        reviewNotificationPreferences: 'use-imported',
      },
    })
    expect(applied).toMatchObject({ status: 'success' })
    expect(target.localReviewRepository.saveNote).toHaveBeenCalledWith(note)
    expect(
      target.workspacePreferencesRepository.upsertSavedFilter,
    ).toHaveBeenCalledWith(filter)
    expect(
      target.reviewNotificationRepository.savePreferences,
    ).toHaveBeenCalledWith(notificationPreferences)
  })

  it('rejects malformed data without reading or writing storage', async () => {
    const dependencies = createDependencies()
    const preview = await createPreviewPortableLocalDataImport(dependencies)(
      '{"schemaVersion":99}',
    )
    expect(preview).toMatchObject({
      status: 'error',
      error: { code: 'unsupported-version' },
    })
    expect(dependencies.localReviewRepository.listNotes).not.toHaveBeenCalled()
    expect(dependencies.localReviewRepository.saveNote).not.toHaveBeenCalled()
  })

  it('reports every conflict category and keeps selected existing values', async () => {
    const dependencies = createDependencies()
    const source = createDependencies()
    vi.mocked(
      source.workspacePreferencesRepository.getGlobalPreferences,
    ).mockResolvedValue({})
    vi.mocked(
      source.reviewNotificationRepository.getPreferences,
    ).mockResolvedValue({ enabled: false, intervalMinutes: 15 })
    const serializedData = await createSerializedData(source)
    const preview =
      await createPreviewPortableLocalDataImport(dependencies)(serializedData)
    expect(preview.status).toBe('success')
    if (preview.status === 'error') return
    expect(preview.preview.conflicts.map(({ category }) => category)).toEqual([
      'notes',
      'reviewTemplates',
      'savedFilters',
      'globalWorkspacePreferences',
      'repositoryWorkspacePreferences',
      'reviewNotificationPreferences',
    ])
    const applied = await createApplyPortableLocalDataImport(dependencies)({
      preview: preview.preview,
      conflictDecisions: {
        notes: 'keep-existing',
        reviewTemplates: 'keep-existing',
        savedFilters: 'keep-existing',
        globalWorkspacePreferences: 'keep-existing',
        repositoryWorkspacePreferences: 'keep-existing',
        reviewNotificationPreferences: 'keep-existing',
      },
    })
    expect(applied).toMatchObject({
      status: 'success',
      skipped: {
        notes: 1,
        reviewTemplates: 1,
        savedFilters: 1,
        globalWorkspacePreferences: 1,
        repositoryWorkspacePreferences: 1,
        reviewNotificationPreferences: 1,
      },
    })
    expect(dependencies.localReviewRepository.saveNote).not.toHaveBeenCalled()
  })

  it('reports partial application when a later category fails', async () => {
    const dependencies = createDependencies()
    vi.mocked(dependencies.localReviewRepository.listNotes).mockResolvedValue(
      [],
    )
    vi.mocked(
      dependencies.localReviewRepository.listTemplates,
    ).mockResolvedValue([])
    vi.mocked(
      dependencies.workspacePreferencesRepository.listSavedFilters,
    ).mockResolvedValue([])
    vi.mocked(
      dependencies.workspacePreferencesRepository.getGlobalPreferences,
    ).mockResolvedValue({})
    vi.mocked(
      dependencies.workspacePreferencesRepository.listRepositoryPreferences,
    ).mockResolvedValue([])
    vi.mocked(
      dependencies.reviewNotificationRepository.getPreferences,
    ).mockResolvedValue({ enabled: false, intervalMinutes: 15 })
    vi.mocked(
      dependencies.workspacePreferencesRepository.upsertSavedFilter,
    ).mockRejectedValue(new Error('quota'))
    const serializedData = await createSerializedData(createDependencies())
    const preview =
      await createPreviewPortableLocalDataImport(dependencies)(serializedData)
    expect(preview.status).toBe('success')
    if (preview.status === 'error') return
    const applied = await createApplyPortableLocalDataImport(dependencies)({
      preview: preview.preview,
      conflictDecisions: {},
    })
    expect(applied).toMatchObject({
      status: 'partial',
      imported: { notes: 1, reviewTemplates: 1 },
    })
  })
})
