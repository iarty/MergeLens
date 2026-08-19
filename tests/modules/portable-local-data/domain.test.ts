import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
vi.mock('wxt/utils/storage', () => ({
  storage: {
    defineItem: (_key: string, options: Record<string, unknown>) => ({
      getValue: vi.fn(async () => options.fallback),
      setValue: vi.fn(async () => undefined),
      watch: vi.fn(() => vi.fn()),
    }),
  },
}));
import {
  PORTABLE_LOCAL_DATA_FORMAT,
  PORTABLE_LOCAL_DATA_SCHEMA_VERSION,
  PortableLocalDataValidationError,
  getPortableDataConflictKey,
  parsePortableLocalData,
} from '@/modules/portable-local-data';

const createPayload = () => ({
  format: PORTABLE_LOCAL_DATA_FORMAT,
  schemaVersion: PORTABLE_LOCAL_DATA_SCHEMA_VERSION,
  exportedAt: '2026-08-19T10:00:00.000Z',
  data: {
    notes: [{
      prKey: 'acme/api#2',
      owner: 'ACME',
      repository: 'API',
      pullNumber: 2,
      body: '  Keep this local  ',
      updatedAt: '2026-08-19T09:00:00.000Z',
    }],
    reviewTemplates: [{
      id: 'template-b',
      title: '  Review  ',
      body: 'Check tests',
      createdAt: '2026-08-18T09:00:00.000Z',
      updatedAt: '2026-08-19T09:00:00.000Z',
    }],
    savedFilters: [{
      id: 'filter-b',
      name: '  Team queue  ',
      view: 'reviewRequests',
      criteria: { repositories: ['ACME/API'], authors: ['@Octo-Cat'], draftState: 'ready' },
    }],
    globalWorkspacePreferences: {},
    repositoryWorkspacePreferences: [{ repositoryKey: 'ACME/API', featureFlags: { savedFilters: true } }],
    reviewNotificationPreferences: { enabled: true, intervalMinutes: 30 },
  },
});

describe('portable local data domain', () => {
  it('normalizes all durable categories and preserves only notification preferences', () => {
    const parsed = parsePortableLocalData(createPayload());

    expect(parsed.data.notes[0]!).toMatchObject({
      prKey: 'acme/api#2', owner: 'acme', repository: 'api', body: '  Keep this local  ',
    });
    expect(parsed.data.reviewTemplates[0]!.title).toBe('Review');
    expect(parsed.data.savedFilters[0]!.criteria).toEqual({
      repositories: ['acme/api'], authors: ['octo-cat'], draftState: 'ready',
    });
    expect(parsed.data.repositoryWorkspacePreferences[0]!.repositoryKey).toBe('acme/api');
    expect(parsed.data.reviewNotificationPreferences).toEqual({ enabled: true, intervalMinutes: 30 });
    expect(JSON.stringify(parsed)).not.toContain('token');
    expect(JSON.stringify(parsed)).not.toContain('snapshot');
  });

  it('rejects future versions and unknown fields before persistence', () => {
    expect(() => parsePortableLocalData({ ...createPayload(), schemaVersion: 99 })).toThrowError(
      expect.objectContaining({ code: 'unsupported-version' }),
    );
    expect(() => parsePortableLocalData({ ...createPayload(), unexpected: true })).toThrowError(
      PortableLocalDataValidationError,
    );
  });

  it('rejects duplicates and invalid records', () => {
    const payload = createPayload();
    const duplicate = { ...payload.data.notes[0] };
    expect(() => parsePortableLocalData({
      ...payload,
      data: { ...payload.data, notes: [payload.data.notes[0], duplicate] },
    })).toThrow('notes.prKey must contain unique values');
    expect(() => parsePortableLocalData({
      ...payload,
      data: { ...payload.data, reviewTemplates: [{ ...payload.data.reviewTemplates[0], body: '' }] },
    })).toThrowError(PortableLocalDataValidationError);
  });

  it('creates deterministic conflict keys for every category', () => {
    const data = parsePortableLocalData(createPayload()).data;
    expect(getPortableDataConflictKey('notes', data.notes[0]!)).toEqual({ category: 'notes', key: 'acme/api#2' });
    expect(getPortableDataConflictKey('reviewTemplates', data.reviewTemplates[0]!)).toEqual({ category: 'reviewTemplates', key: 'template-b' });
    expect(getPortableDataConflictKey('savedFilters', data.savedFilters[0]!)).toEqual({ category: 'savedFilters', key: 'filter-b' });
    expect(getPortableDataConflictKey('repositoryWorkspacePreferences', data.repositoryWorkspacePreferences[0]!)).toEqual({ category: 'repositoryWorkspacePreferences', key: 'acme/api' });
    expect(getPortableDataConflictKey('globalWorkspacePreferences', data.globalWorkspacePreferences)).toEqual({ category: 'globalWorkspacePreferences', key: 'singleton' });
    expect(getPortableDataConflictKey('reviewNotificationPreferences', data.reviewNotificationPreferences)).toEqual({ category: 'reviewNotificationPreferences', key: 'singleton' });
  });
});
