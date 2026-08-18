import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const definitions = new Map<string, Record<string, unknown>>();
  const watchers = new Map<string, Set<() => void>>();
  return { values, definitions, watchers };
});

vi.mock('wxt/utils/storage', () => ({
  storage: {
    defineItem: (key: string, options: Record<string, unknown>) => {
      storageMock.definitions.set(key, options);
      return {
        getValue: async () => storageMock.values.has(key)
          ? storageMock.values.get(key)
          : options.fallback,
        setValue: async (value: unknown) => { storageMock.values.set(key, value); },
        watch: (listener: () => void) => {
          const listeners = storageMock.watchers.get(key) ?? new Set();
          listeners.add(listener);
          storageMock.watchers.set(key, listeners);
          return () => listeners.delete(listener);
        },
      };
    },
  },
}));

import {
  DEFAULT_REVIEW_NOTIFICATION_PREFERENCES,
  MAX_NOTIFICATION_ROUTES,
  WxtReviewNotificationStateRepository,
  parseGitHubPullRequestUrl,
  reviewNotificationStorageKeys,
} from '@/modules/review-notifications';
import { OctokitReviewNotificationSource } from '@/modules/review-notifications/adapters/OctokitReviewNotificationSource';

describe('review notification adapters', () => {
  beforeEach(() => {
    storageMock.values.clear();
    storageMock.watchers.clear();
  });

  it('uses safe defaults for malformed and future storage records', async () => {
    storageMock.values.set(reviewNotificationStorageKeys.preferences, {
      schemaVersion: 99,
      value: { enabled: true, intervalMinutes: 1 },
    });
    storageMock.values.set(reviewNotificationStorageKeys.state, 'malformed');
    const repository = new WxtReviewNotificationStateRepository();

    await expect(repository.getPreferences()).resolves.toEqual(
      DEFAULT_REVIEW_NOTIFICATION_PREFERENCES,
    );
    await expect(repository.getSnapshot()).resolves.toMatchObject({
      initialized: false,
      activeCandidateIds: [],
    });
  });

  it('deduplicates and bounds routes while disabling clears them', async () => {
    const repository = new WxtReviewNotificationStateRepository();
    const routes = Array.from({ length: MAX_NOTIFICATION_ROUTES + 5 }, (_, index) => ({
      notificationId: `mergelens-review:${index % MAX_NOTIFICATION_ROUTES}`,
      url: `https://github.com/acme/repo/pull/${index + 1}`,
      createdAt: `2026-08-18T10:${(index % 60).toString().padStart(2, '0')}:00.000Z`,
    }));

    await repository.saveRoutes(routes);
    await expect(repository.listRoutes()).resolves.toHaveLength(MAX_NOTIFICATION_ROUTES);
    await repository.savePreferences({ enabled: false, intervalMinutes: 15 });
    await expect(repository.listRoutes()).resolves.toEqual([]);
  });

  it('validates click targets as HTTPS GitHub pull requests', () => {
    expect(parseGitHubPullRequestUrl('https://github.com/acme/repo/pull/12'))
      .toBe('https://github.com/acme/repo/pull/12');
    expect(() => parseGitHubPullRequestUrl('http://github.com/acme/repo/pull/12'))
      .toThrow();
    expect(() => parseGitHubPullRequestUrl('https://example.com/acme/repo/pull/12'))
      .toThrow();
    expect(() => parseGitHubPullRequestUrl('https://github.com/acme/repo/issues/12'))
      .toThrow();
  });

  it('loads only the bounded review-request section once per poll', async () => {
    const readSection = vi.fn(async () => ({
      status: 'success' as const,
      items: [{
        id: 'candidate-1',
        title: 'Review me',
        url: 'https://github.com/acme/repo/pull/1',
        repository: {
          owner: 'acme',
          name: 'repo',
          fullName: 'acme/repo',
          url: 'https://github.com/acme/repo',
        },
        number: 1,
        authorLogin: 'octocat',
        isDraft: false,
        updatedAt: '2026-08-18T12:00:00.000Z',
        reasons: ['review-requested' as const],
      }],
    }));
    const source = new OctokitReviewNotificationSource({ readSection });

    await expect(source.listReviewRequests()).resolves.toMatchObject({
      status: 'success',
      candidates: [{ id: 'candidate-1' }],
    });
    expect(readSection).toHaveBeenCalledOnce();
    expect(readSection).toHaveBeenCalledWith({ kind: 'review-requests', limit: 20 });
  });
});
