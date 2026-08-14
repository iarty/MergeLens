import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageState = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('wxt/utils/storage', () => ({
  storage: {
    defineItem: () => ({
      getValue: vi.fn(async () => storageState.value),
      setValue: vi.fn(async (value: unknown[]) => { storageState.value = value; }),
    }),
  },
}));

import {
  readConfiguredQuickLinks,
  removeConfiguredQuickLink,
  saveConfiguredQuickLink,
} from '@/modules/quick-links/settings';

describe('configured quick links storage', () => {
  beforeEach(() => { storageState.value = []; });

  it('saves, sorts, updates, and removes links', async () => {
    await saveConfiguredQuickLink({ id: 'z', label: 'Zeta', url: 'https://z.example.com/' });
    await saveConfiguredQuickLink({ id: 'a', label: 'Alpha', url: 'https://a.example.com/' });
    expect((await readConfiguredQuickLinks()).map(({ id }) => id)).toEqual(['a', 'z']);
    await saveConfiguredQuickLink({ id: 'a', label: 'Beta', url: 'https://b.example.com/' });
    expect(await removeConfiguredQuickLink('z')).toEqual([{ id: 'a', label: 'Beta', url: 'https://b.example.com/' }]);
  });

  it('rejects non-HTTPS URLs', async () => {
    await expect(saveConfiguredQuickLink({ id: 'bad', label: 'Bad', url: 'http://example.com/' })).rejects.toThrow();
  });
});
