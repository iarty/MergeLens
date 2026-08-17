import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  MAX_SAVED_FILTER_COUNT,
  WorkspacePreferencesValidationError,
  createRepositoryKey,
  matchesSavedInboxFilter,
  normalizeRepositoryKey,
  normalizeSavedInboxFilterDraft,
  normalizeSavedInboxFilters,
  resolveEffectiveWorkspacePreferences,
  toWorkspacePreferencesError,
  upsertSavedInboxFilter,
  type SavedInboxFilter,
} from '@/modules/workspace-preferences';
import type { ReviewInboxPullRequest } from '@/modules/pull-requests';
import { createGetEffectiveWorkspacePreferences } from '@/modules/workspace-preferences';
import type { WorkspacePreferencesRepository } from '@/modules/workspace-preferences';

const createFilter = (
  overrides: Partial<SavedInboxFilter> = {},
): SavedInboxFilter => ({
  id: 'filter-1',
  name: 'Ready reviews',
  view: 'reviewRequests',
  criteria: {
    repositories: [],
    authors: [],
    draftState: 'ready',
  },
  ...overrides,
});

const pullRequest: ReviewInboxPullRequest = {
  id: 'pr-42',
  number: 42,
  title: 'Add workspace preferences',
  url: 'https://github.com/OpenAI/Codex/pull/42',
  repository: {
    owner: 'OpenAI',
    name: 'Codex',
    fullName: 'OpenAI/Codex',
    url: 'https://github.com/OpenAI/Codex',
  },
  authorLogin: 'Octo-Cat',
  isDraft: false,
  updatedAt: '2026-08-17T10:00:00.000Z',
  reasons: ['review-requested'],
};

describe('workspace preferences domain', () => {
  it('resolves repository overrides and falls back safely for malformed context', async () => {
    const repository: WorkspacePreferencesRepository = {
      listSavedFilters: async () => [],
      upsertSavedFilter: async () => [],
      deleteSavedFilter: async () => [],
      getGlobalPreferences: async () => ({
        featureFlags: { savedFilters: false },
      }),
      saveGlobalPreferences: async (preferences) => preferences,
      listRepositoryPreferences: async () => [],
      getRepositoryPreferences: async () => ({
        repositoryKey: 'openai/codex',
        featureFlags: { savedFilters: true },
      }),
      upsertRepositoryPreferences: async () => [],
      deleteRepositoryPreferences: async () => [],
    };
    const resolve = createGetEffectiveWorkspacePreferences(repository);

    await expect(resolve(' OpenAI/Codex ')).resolves.toMatchObject({
      repositoryKey: 'openai/codex',
      source: 'repository',
      preferences: {
        featureFlags: { savedFilters: true },
      },
    });
    await expect(resolve('malformed')).resolves.toMatchObject({
      repositoryKey: null,
      source: 'global',
      preferences: { featureFlags: { savedFilters: false } },
    });
  });
  it('creates canonical repository keys', () => {
    expect(
      createRepositoryKey({ owner: ' OpenAI ', repository: ' Codex ' }),
    ).toBe('openai/codex');
    expect(normalizeRepositoryKey(' OpenAI/Codex ')).toBe('openai/codex');
    expect(() => normalizeRepositoryKey('openai/codex/extra')).toThrow(
      WorkspacePreferencesValidationError,
    );
  });

  it('normalizes filter criteria without duplicate values', () => {
    expect(
      normalizeSavedInboxFilterDraft({
        name: '  My reviews  ',
        view: 'assigned',
        criteria: {
          repositories: ['OpenAI/Codex', 'openai/codex'],
          authors: ['@Octo-Cat', 'octo-cat'],
          draftState: 'any',
        },
      }),
    ).toEqual({
      name: 'My reviews',
      view: 'assigned',
      criteria: {
        repositories: ['openai/codex'],
        authors: ['octo-cat'],
        draftState: 'any',
      },
    });
  });

  it('sorts filters and rejects duplicate names', () => {
    expect(
      normalizeSavedInboxFilters([
        createFilter({ id: 'z', name: 'Zeta' }),
        createFilter({ id: 'a', name: 'Alpha' }),
      ]).map(({ id }) => id),
    ).toEqual(['a', 'z']);

    expect(() =>
      normalizeSavedInboxFilters([
        createFilter({ id: 'a', name: 'Ready' }),
        createFilter({ id: 'b', name: ' ready ' }),
      ]),
    ).toThrow('Saved filter names must be unique');
  });

  it('applies default, global, and repository preference precedence', () => {
    expect(resolveEffectiveWorkspacePreferences()).toEqual(
      DEFAULT_WORKSPACE_PREFERENCES,
    );
    expect(
      resolveEffectiveWorkspacePreferences(
        {
          featureFlags: { savedFilters: false },
          commandPaletteShortcut: 'primary-shift-k',
        },
        {
          repositoryKey: 'OpenAI/Codex',
          featureFlags: { savedFilters: true },
          commandPaletteShortcut: 'primary-shift-p',
        },
      ),
    ).toEqual({
      featureFlags: {
        savedFilters: true,
        customCommandPaletteShortcut: true,
      },
      commandPaletteShortcut: 'primary-shift-p',
    });
  });

  it('matches normalized inbox items against all filter criteria', () => {
    const filter = createFilter({
      criteria: {
        repositories: ['openai/codex'],
        authors: ['octo-cat'],
        draftState: 'ready',
      },
    });
    expect(matchesSavedInboxFilter(pullRequest, filter)).toBe(true);
    expect(
      matchesSavedInboxFilter(
        { ...pullRequest, authorLogin: null },
        filter,
      ),
    ).toBe(false);
    expect(
      matchesSavedInboxFilter({ ...pullRequest, isDraft: true }, filter),
    ).toBe(false);
  });
});

describe('workspace preferences application operations', () => {
  it('upserts and deterministically sorts filters', () => {
    const next = upsertSavedInboxFilter(
      [createFilter({ id: 'z', name: 'Zeta' })],
      {
        name: ' Alpha ',
        view: 'recentActivity',
        criteria: { repositories: [], authors: [], draftState: 'any' },
      },
      () => 'a',
    );

    expect(next.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'a', name: 'Alpha' },
      { id: 'z', name: 'Zeta' },
    ]);
  });

  it('rejects insertion beyond the saved-filter limit', () => {
    const filters = Array.from({ length: MAX_SAVED_FILTER_COUNT }, (_, index) =>
      createFilter({ id: `filter-${index}`, name: `Filter ${index}` }),
    );

    expect(() =>
      upsertSavedInboxFilter(
        filters,
        {
          name: 'Overflow',
          view: 'assigned',
          criteria: { repositories: [], authors: [], draftState: 'any' },
        },
        () => 'overflow',
      ),
    ).toThrow(`No more than ${MAX_SAVED_FILTER_COUNT} saved filters are allowed`);
  });

  it('maps validation failures without returning invalid input values', () => {
    expect(
      toWorkspacePreferencesError(
        new WorkspacePreferencesValidationError('Invalid filter', 'name', 2),
      ),
    ).toEqual({
      code: 'invalid-input',
      message: 'Invalid filter',
      issueCount: 2,
    });
  });
});
