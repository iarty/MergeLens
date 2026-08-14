import { describe, expect, it, vi } from 'vitest';
import { createCommandPaletteController } from '@/features/command-palette/commandPaletteController';
import type { CommandId } from '@/features/command-palette/types';

const createFakeContext = () => {
  let invalidationHandler: (() => void) | undefined;
  let locationHandler: ((event: { newUrl: URL }) => void) | undefined;
  return {
    context: {
      addEventListener: vi.fn((
        _target: Window,
        _event: string,
        handler: (event: { newUrl: URL }) => void,
      ) => {
        locationHandler = handler;
      }),
      onInvalidated: vi.fn((handler: () => void) => {
        invalidationHandler = handler;
      }),
    },
    navigate: (url: string) => locationHandler?.({ newUrl: new URL(url) }),
    invalidate: () => invalidationHandler?.(),
  };
};

const createFakeUi = () => ({
  mount: vi.fn(),
  remove: vi.fn(),
  render: vi.fn(),
});

const getLatestRenderProps = (ui: ReturnType<typeof createFakeUi>) => {
  return ui.render.mock.lastCall?.[0] as {
    context: { pageContext: { pullNumber: number } | null };
    onExecute: (commandId: CommandId) => Promise<void>;
  };
};

describe('command palette integration', () => {
  it('uses the latest SPA context when executing commands', async () => {
    history.replaceState({}, '', '/facebook/react/pull/42');
    const fakeContext = createFakeContext();
    const ui = createFakeUi();
    const navigate = vi.fn();
    createCommandPaletteController(fakeContext.context as never, ui, window, { navigate });

    try {
      fakeContext.navigate('https://github.com/facebook/react/pull/43');
      const props = getLatestRenderProps(ui);
      await props.onExecute('open-current-pull-request');

      expect(navigate).toHaveBeenCalledWith('https://github.com/facebook/react/pull/43');
    } finally {
      fakeContext.invalidate();
    }
  });

  it('delegates local review, settings, and toolbar refresh without exposing data', async () => {
    history.replaceState({}, '', '/facebook/react/pull/42');
    const fakeContext = createFakeContext();
    const ui = createFakeUi();
    const openSettings = vi.fn().mockResolvedValue(undefined);
    const openLocalReviewWorkspace = vi.fn().mockResolvedValue(undefined);
    const refreshPullRequestToolbar = vi.fn().mockResolvedValue(undefined);
    createCommandPaletteController(fakeContext.context as never, ui, window, {
      openSettings,
      openLocalReviewWorkspace,
      refreshPullRequestToolbar,
    });
    try {
      const props = getLatestRenderProps(ui);

      await props.onExecute('open-settings');
      await props.onExecute('open-local-review-workspace');
      await props.onExecute('refresh-pull-request-toolbar');

      expect(openSettings).toHaveBeenCalledOnce();
      expect(openLocalReviewWorkspace).toHaveBeenCalledOnce();
      expect(refreshPullRequestToolbar).toHaveBeenCalledOnce();
      expect(ui.render.mock.calls.flat()).not.toContain(
        expect.stringMatching(/token|credential|note body|template body/i),
      );
    } finally {
      fakeContext.invalidate();
    }
  });

  it('handles an unavailable local review callback without failing execution', async () => {
    history.replaceState({}, '', '/facebook/react/pull/42');
    const fakeContext = createFakeContext();
    const ui = createFakeUi();
    const controller = createCommandPaletteController(
      fakeContext.context as never,
      ui,
      window,
    );

    try {
      controller.open();
      const props = getLatestRenderProps(ui);

      await expect(
        props.onExecute('open-local-review-workspace'),
      ).resolves.toBeUndefined();
      expect(ui.render.mock.lastCall?.[0]).toMatchObject({ isOpen: false });
    } finally {
      fakeContext.invalidate();
    }
  });

  it('is singleton per window and cleans up on invalidation', () => {
    history.replaceState({}, '', '/facebook/react/pull/42');
    const fakeContext = createFakeContext();
    const ui = createFakeUi();

    const first = createCommandPaletteController(fakeContext.context as never, ui, window);
    const second = createCommandPaletteController(fakeContext.context as never, createFakeUi(), window);

    expect(second).toBe(first);
    expect(fakeContext.context.addEventListener).toHaveBeenCalledOnce();
    fakeContext.invalidate();
    expect(ui.remove).toHaveBeenCalledOnce();
  });

  it('opens from an extension request and removes the listener on invalidation', () => {
    history.replaceState({}, '', '/facebook/react/pull/42');
    const fakeContext = createFakeContext();
    const ui = createFakeUi();
    let openFromRequest: (() => void) | undefined;
    const removeOpenRequest = vi.fn();

    createCommandPaletteController(fakeContext.context as never, ui, window, {
      registerOpenRequest: (open) => {
        openFromRequest = open;
        return removeOpenRequest;
      },
    });

    openFromRequest?.();
    expect(ui.render.mock.lastCall?.[0]).toMatchObject({ isOpen: true });

    fakeContext.invalidate();
    expect(removeOpenRequest).toHaveBeenCalledOnce();
  });
});
