import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const definitions = new Map<string, Record<string, unknown>>();
  const getValue = vi.fn(async (key: string, fallback: unknown) =>
    values.has(key) ? values.get(key) : fallback,
  );
  const setValue = vi.fn(async (key: string, value: unknown) => {
    values.set(key, value);
  });
  return { values, definitions, getValue, setValue };
});

vi.mock('wxt/utils/storage', () => ({
  storage: {
    defineItem: (key: string, options: Record<string, unknown>) => {
      storageMock.definitions.set(key, options);
      return {
        key,
        fallback: options.fallback,
        defaultValue: options.fallback,
        getValue: () => storageMock.getValue(key, options.fallback),
        setValue: (value: unknown) => storageMock.setValue(key, value),
      };
    },
  },
}));

import {
  MAX_WORKSPACE_PREFERENCES_SYNC_ITEM_BYTES,
  WORKSPACE_PREFERENCES_STORAGE_VERSION,
  WorkspacePreferencesRepositoryError,
  WxtWorkspacePreferencesRepository,
  type SavedInboxFilter,
} from '@/modules/workspace-preferences';

const SAVED_FILTERS_KEY = 'sync:workspacePreferences.savedFilters';
const GLOBAL_PREFERENCES_KEY = 'sync:workspacePreferences.global';
const REPOSITORY_PREFERENCES_KEY =
  'sync:workspacePreferences.repositories';

const createFilter = (
  id: string,
  name: string,
  repositories: string[] = [],
): SavedInboxFilter => ({
  id,
  name,
  view: 'reviewRequests',
  criteria: { repositories, authors: [], draftState: 'any' },
});

describe('WxtWorkspacePreferencesRepository', () => {
  beforeEach(() => {
    storageMock.values.clear();
    storageMock.getValue.mockClear();
    storageMock.setValue.mockClear();
  });

  it('defines three versioned sync storage records', async () => {
    await new WxtWorkspacePreferencesRepository().listSavedFilters();
    expect([...storageMock.definitions.keys()]).toEqual([
      SAVED_FILTERS_KEY,
      GLOBAL_PREFERENCES_KEY,
      REPOSITORY_PREFERENCES_KEY,
    ]);
    for (const definition of storageMock.definitions.values()) {
      expect(definition.version).toBe(WORKSPACE_PREFERENCES_STORAGE_VERSION);
      expect(definition.fallback).toMatchObject({ schemaVersion: 1 });
    }
  });

  it('upserts, normalizes, sorts, and deletes saved filters', async () => {
    const repository = new WxtWorkspacePreferencesRepository();

    await repository.upsertSavedFilter(createFilter('z', ' Zeta '));
    const saved = await repository.upsertSavedFilter(
      createFilter('a', 'Alpha', ['OpenAI/Codex']),
    );

    expect(saved.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'a', name: 'Alpha' },
      { id: 'z', name: 'Zeta' },
    ]);
    expect(saved[0]?.criteria.repositories).toEqual(['openai/codex']);
    await expect(repository.deleteSavedFilter('z')).resolves.toHaveLength(1);
  });

  it('returns safe fallbacks for corrupted stored records', async () => {
    storageMock.values.set(SAVED_FILTERS_KEY, {
      schemaVersion: 1,
      value: [{ id: '', name: 'Invalid' }],
    });
    storageMock.values.set(GLOBAL_PREFERENCES_KEY, {
      schemaVersion: 99,
      value: { commandPaletteShortcut: 'unknown' },
    });
    storageMock.values.set(REPOSITORY_PREFERENCES_KEY, 'invalid');
    const repository = new WxtWorkspacePreferencesRepository();

    await expect(repository.listSavedFilters()).resolves.toEqual([]);
    await expect(repository.getGlobalPreferences()).resolves.toEqual({});
    await expect(repository.listRepositoryPreferences()).resolves.toEqual([]);
  });

  it('persists global and deterministically sorted repository preferences', async () => {
    const repository = new WxtWorkspacePreferencesRepository();

    await expect(
      repository.saveGlobalPreferences({
        featureFlags: { savedFilters: false },
        commandPaletteShortcut: 'primary-shift-k',
      }),
    ).resolves.toEqual({
      featureFlags: { savedFilters: false },
      commandPaletteShortcut: 'primary-shift-k',
    });
    await repository.upsertRepositoryPreferences({
      repositoryKey: 'Zeta/Repo',
      featureFlags: { savedFilters: false },
    });
    const preferences = await repository.upsertRepositoryPreferences({
      repositoryKey: 'Alpha/Repo',
      commandPaletteShortcut: 'primary-shift-p',
    });

    expect(preferences.map(({ repositoryKey }) => repositoryKey)).toEqual([
      'alpha/repo',
      'zeta/repo',
    ]);
    await expect(
      repository.getRepositoryPreferences('ALPHA/REPO'),
    ).resolves.toMatchObject({ repositoryKey: 'alpha/repo' });
    await expect(
      repository.deleteRepositoryPreferences('zeta/repo'),
    ).resolves.toHaveLength(1);
  });

  it('rejects oversized records before calling browser storage', async () => {
    const repository = new WxtWorkspacePreferencesRepository();
    const repositories = Array.from(
      { length: 20 },
      (_, index) => `owner-${index.toString().padStart(2, '0')}/${'r'.repeat(100)}`,
    );

    await repository.upsertSavedFilter(
      createFilter('large-1', 'Large 1', repositories),
    );
    await repository.upsertSavedFilter(
      createFilter('large-2', 'Large 2', repositories),
    );
    await repository.upsertSavedFilter(
      createFilter('large-3', 'Large 3', repositories),
    );
    const writeCount = storageMock.setValue.mock.calls.length;

    await expect(
      repository.upsertSavedFilter(
        createFilter('large-4', 'Large 4', repositories),
      ),
    ).rejects.toMatchObject({ code: 'quota-exceeded' });
    expect(storageMock.setValue).toHaveBeenCalledTimes(writeCount);
    expect(MAX_WORKSPACE_PREFERENCES_SYNC_ITEM_BYTES).toBeLessThan(8_192);
  });

  it('maps browser quota failures to a typed repository error', async () => {
    storageMock.setValue.mockRejectedValueOnce(
      new DOMException('QUOTA_BYTES_PER_ITEM exceeded', 'QuotaExceededError'),
    );
    const repository = new WxtWorkspacePreferencesRepository();

    await expect(
      repository.upsertSavedFilter(createFilter('one', 'One')),
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkspacePreferencesRepositoryError>>({
        name: 'WorkspacePreferencesRepositoryError',
        code: 'quota-exceeded',
      }),
    );
  });

  it('serializes concurrent read-modify-write filter mutations', async () => {
    let releaseFirstWrite: (() => void) | undefined;
    const firstWriteBlocked = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    storageMock.setValue.mockImplementationOnce(async (key, value) => {
      await firstWriteBlocked;
      storageMock.values.set(key, value);
    });
    const firstRepository = new WxtWorkspacePreferencesRepository();
    const secondRepository = new WxtWorkspacePreferencesRepository();

    const first = firstRepository.upsertSavedFilter(createFilter('a', 'Alpha'));
    await vi.waitFor(() => expect(storageMock.setValue).toHaveBeenCalledTimes(1));
    const second = secondRepository.upsertSavedFilter(createFilter('z', 'Zeta'));
    await Promise.resolve();
    expect(storageMock.getValue).toHaveBeenCalledTimes(1);

    releaseFirstWrite?.();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    await expect(firstRepository.listSavedFilters()).resolves.toHaveLength(2);
  });
});
