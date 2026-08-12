import { describe, expect, it, vi } from 'vitest';
import { mountPrToolbar } from '@/features/pr-toolbar/mountPrToolbar';
import type { PullRequestPageContext } from '@/shared/github/context/PageContext';
import type { PRToolbarState } from '@/features/pr-toolbar/types';

const context: PullRequestPageContext = {
  kind: 'pull-request',
  owner: 'facebook',
  repository: 'react',
  pullNumber: 42,
  url: 'https://github.com/facebook/react/pull/42',
};

const nextContext: PullRequestPageContext = {
  ...context,
  pullNumber: 43,
  url: 'https://github.com/facebook/react/pull/43',
};

const successResponse = {
  status: 'success' as const,
  correlationId: 'request-1',
  data: {
    pullRequest: {
      title: 'React toolbar',
      url: context.url,
      state: 'open' as const,
      isDraft: false,
      authorLogin: 'sebmarkbage',
    },
    checks: [],
    actionsUrl: 'https://github.com/facebook/react/actions',
  },
};

const createFakeContext = () => {
  let invalidationHandler: (() => void) | undefined;
  return {
    context: {
      onInvalidated: vi.fn((handler: () => void) => {
        invalidationHandler = handler;
      }),
    },
    invalidate: () => invalidationHandler?.(),
  };
};

const createFakeUi = () => ({
  autoMount: vi.fn(),
  remove: vi.fn(),
  render: vi.fn<(state: PRToolbarState) => void>(),
});

describe('mountPrToolbar', () => {
  it('mounts once and ignores duplicate reconciliation for the same PR', async () => {
    const fakeContext = createFakeContext();
    const fakeUi = createFakeUi();
    const createUi = vi.fn().mockResolvedValue(fakeUi);
    const sendToolbarMessage = vi.fn().mockResolvedValue(successResponse);
    const toolbar = await mountPrToolbar(fakeContext.context as never, {
      createUi,
      sendToolbarMessage,
      findAnchor: () => document.body,
    });

    await toolbar.reconcile(context);
    await toolbar.reconcile({ ...context, url: `${context.url}/files` });

    expect(createUi).toHaveBeenCalledOnce();
    expect(fakeUi.autoMount).toHaveBeenCalledOnce();
    expect(sendToolbarMessage).toHaveBeenCalledOnce();
    expect(fakeUi.render).toHaveBeenLastCalledWith({
      status: 'success',
      data: successResponse.data,
    });
  });

  it('reuses the UI and reloads data when navigating to another PR', async () => {
    const fakeContext = createFakeContext();
    const fakeUi = createFakeUi();
    const sendToolbarMessage = vi.fn().mockResolvedValue(successResponse);
    const toolbar = await mountPrToolbar(fakeContext.context as never, {
      createUi: vi.fn().mockResolvedValue(fakeUi),
      sendToolbarMessage,
      findAnchor: () => document.body,
    });

    await toolbar.reconcile(context);
    await toolbar.reconcile(nextContext);

    expect(fakeUi.autoMount).toHaveBeenCalledOnce();
    expect(sendToolbarMessage).toHaveBeenCalledTimes(2);
    expect(fakeUi.remove).not.toHaveBeenCalled();
  });

  it('creates only one UI during concurrent reconciliations', async () => {
    const fakeContext = createFakeContext();
    const fakeUi = createFakeUi();
    let resolveUi: ((value: typeof fakeUi) => void) | undefined;
    const pendingUi = new Promise<typeof fakeUi>((resolve) => {
      resolveUi = resolve;
    });
    const createUi = vi.fn().mockReturnValue(pendingUi);
    const sendToolbarMessage = vi.fn().mockResolvedValue(successResponse);
    const toolbar = await mountPrToolbar(fakeContext.context as never, {
      createUi,
      sendToolbarMessage,
      findAnchor: () => document.body,
    });

    const firstReconciliation = toolbar.reconcile(context);
    const secondReconciliation = toolbar.reconcile(nextContext);
    resolveUi?.(fakeUi);
    await Promise.all([firstReconciliation, secondReconciliation]);

    expect(createUi).toHaveBeenCalledOnce();
    expect(fakeUi.autoMount).toHaveBeenCalledOnce();
    expect(sendToolbarMessage).toHaveBeenCalledOnce();
    expect(sendToolbarMessage).toHaveBeenCalledWith(
      'getPullRequestToolbarData',
      expect.objectContaining({ context: nextContext }),
    );
  });

  it('removes on non-PR navigation and creates a clean UI when returning', async () => {
    const fakeContext = createFakeContext();
    const firstUi = createFakeUi();
    const secondUi = createFakeUi();
    const createUi = vi.fn()
      .mockResolvedValueOnce(firstUi)
      .mockResolvedValueOnce(secondUi);
    const toolbar = await mountPrToolbar(fakeContext.context as never, {
      createUi,
      sendToolbarMessage: vi.fn().mockResolvedValue(successResponse),
      findAnchor: () => document.body,
    });

    await toolbar.reconcile(context);
    await toolbar.reconcile(null);
    await toolbar.reconcile(context);

    expect(firstUi.remove).toHaveBeenCalledOnce();
    expect(secondUi.autoMount).toHaveBeenCalledOnce();
    expect(createUi).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale response after navigating to another PR', async () => {
    const fakeContext = createFakeContext();
    const fakeUi = createFakeUi();
    let resolveFirstRequest: ((value: typeof successResponse) => void) | undefined;
    const firstRequest = new Promise<typeof successResponse>((resolve) => {
      resolveFirstRequest = resolve;
    });
    const sendToolbarMessage = vi.fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({
        ...successResponse,
        data: {
          ...successResponse.data,
          pullRequest: {
            ...successResponse.data.pullRequest,
            title: 'New pull request',
            url: nextContext.url,
          },
        },
      });
    const toolbar = await mountPrToolbar(fakeContext.context as never, {
      createUi: vi.fn().mockResolvedValue(fakeUi),
      sendToolbarMessage,
      findAnchor: () => document.body,
    });

    const firstReconciliation = toolbar.reconcile(context);
    await vi.waitFor(() => expect(sendToolbarMessage).toHaveBeenCalledOnce());
    await toolbar.reconcile(nextContext);
    resolveFirstRequest?.(successResponse);
    await firstReconciliation;

    expect(fakeUi.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({
          pullRequest: expect.objectContaining({ title: 'New pull request' }),
        }),
      }),
    );
  });

  it('renders a retryable state when the background receiver is unavailable', async () => {
    const fakeContext = createFakeContext();
    const fakeUi = createFakeUi();
    const toolbar = await mountPrToolbar(fakeContext.context as never, {
      createUi: vi.fn().mockResolvedValue(fakeUi),
      sendToolbarMessage: vi.fn().mockRejectedValue(
        new Error('Receiving end does not exist'),
      ),
      findAnchor: () => document.body,
    });

    await toolbar.reconcile(context);

    expect(fakeUi.render).toHaveBeenLastCalledWith({
      status: 'error',
      error: {
        code: 'receiver-unavailable',
        message: 'MergeLens background is unavailable',
      },
    });
  });

  it('starts dynamic anchor observation when the GitHub anchor is absent', async () => {
    const fakeContext = createFakeContext();
    const fakeUi = createFakeUi();
    const toolbar = await mountPrToolbar(fakeContext.context as never, {
      createUi: vi.fn().mockResolvedValue(fakeUi),
      sendToolbarMessage: vi.fn().mockResolvedValue(successResponse),
      findAnchor: () => null,
    });

    await toolbar.reconcile(context);

    expect(fakeUi.autoMount).toHaveBeenCalledOnce();
  });

  it('removes the UI and invalidates pending requests on context invalidation', async () => {
    const fakeContext = createFakeContext();
    const fakeUi = createFakeUi();
    let resolveRequest: ((value: typeof successResponse) => void) | undefined;
    const request = new Promise<typeof successResponse>((resolve) => {
      resolveRequest = resolve;
    });
    const toolbar = await mountPrToolbar(fakeContext.context as never, {
      createUi: vi.fn().mockResolvedValue(fakeUi),
      sendToolbarMessage: vi.fn().mockReturnValue(request),
      findAnchor: () => document.body,
    });

    const reconciliation = toolbar.reconcile(context);
    await vi.waitFor(() => expect(fakeUi.autoMount).toHaveBeenCalledOnce());
    fakeContext.invalidate();
    resolveRequest?.(successResponse);
    await reconciliation;

    expect(fakeUi.remove).toHaveBeenCalledOnce();
    expect(fakeUi.render).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'success' }),
    );
  });

  it('discards an UI that finishes creating after leaving the PR', async () => {
    const fakeContext = createFakeContext();
    const fakeUi = createFakeUi();
    let resolveUi: ((value: typeof fakeUi) => void) | undefined;
    const pendingUi = new Promise<typeof fakeUi>((resolve) => {
      resolveUi = resolve;
    });
    const sendToolbarMessage = vi.fn();
    const toolbar = await mountPrToolbar(fakeContext.context as never, {
      createUi: vi.fn().mockReturnValue(pendingUi),
      sendToolbarMessage,
      findAnchor: () => document.body,
    });

    const reconciliation = toolbar.reconcile(context);
    await toolbar.reconcile(null);
    resolveUi?.(fakeUi);
    await reconciliation;

    expect(fakeUi.remove).toHaveBeenCalledOnce();
    expect(fakeUi.autoMount).not.toHaveBeenCalled();
    expect(sendToolbarMessage).not.toHaveBeenCalled();
  });
});
