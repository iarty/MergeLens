import { createRoot, type Root } from 'react-dom/client';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { PullRequestPageContext } from '@/shared/github/context/PageContext';
import {
  findPullRequestToolbarAnchor,
  resolvePullRequestToolbarAnchorSelector,
} from '@/shared/github/dom/selectors';
import { createLogger } from '@/shared/logging/logger';
import {
  createCorrelationId,
  isReceiverUnavailableError,
  sendMessage,
} from '@/shared/messaging/protocol';
import type { ToolbarResponse } from '@/shared/messaging/schemas';
import { PRToolbar } from './PRToolbar';
import type { PRToolbarState } from './types';
import './PRToolbar.css';

const logger = createLogger('prToolbar.mount');

const appendToolbar = (anchor: Element, ui: Element): void => {
  if (anchor.id === 'diff-comparison-viewer-container') {
    const header = anchor.querySelector('[data-component="SplitPageLayout.Header"]');
    if (header) {
      header.insertAdjacentElement('afterend', ui);
      return;
    }

    anchor.prepend(ui);
    return;
  }

  anchor.parentElement?.insertBefore(ui, anchor.nextElementSibling);
};

interface ToolbarUi {
  autoMount: () => void;
  remove: () => void;
  render: (state: PRToolbarState) => void;
}

interface ToolbarUiCallbacks {
  onOpenSettings: () => void;
  onRetry: () => void;
}

type ToolbarUiFactory = (
  ctx: ContentScriptContext,
  callbacks: ToolbarUiCallbacks,
) => Promise<ToolbarUi>;

interface ToolbarMountOptions {
  createUi?: ToolbarUiFactory;
  sendToolbarMessage?: typeof sendMessage;
  findAnchor?: typeof findPullRequestToolbarAnchor;
  openSettings?: () => void | Promise<void>;
}

const createToolbarUi: ToolbarUiFactory = async (ctx, callbacks) => {
  let currentState: PRToolbarState = { status: 'unsupported-context' };
  let hostObserver: MutationObserver | null = null;
  const ui = await createShadowRootUi<Root>(ctx, {
    name: 'mergelens-pr-toolbar',
    position: 'inline',
    anchor: resolvePullRequestToolbarAnchorSelector,
    append: appendToolbar,
    isolateEvents: ['click', 'keydown'],
    onMount: (container) => {
      const root = createRoot(container);
      root.render(
        <PRToolbar
          state={currentState}
          onOpenSettings={callbacks.onOpenSettings}
          onRetry={callbacks.onRetry}
        />,
      );
      return root;
    },
    onRemove: (root) => root?.unmount(),
  });

  const render = (state: PRToolbarState) => {
    currentState = state;
    ui.mounted?.render(
      <PRToolbar
        state={currentState}
        onOpenSettings={callbacks.onOpenSettings}
        onRetry={callbacks.onRetry}
      />,
    );
  };

  return {
    autoMount: () => {
      ui.autoMount();
      hostObserver ??= new MutationObserver(() => {
        if (ui.shadowHost.isConnected) {
          return;
        }

        logger.debug('[FIX:pr-toolbar-lifecycle] Detected detached Shadow host', {
          toolbarStatus: currentState.status,
        });
        const selector = resolvePullRequestToolbarAnchorSelector();
        const anchor = selector ? document.querySelector(selector) : null;
        if (!anchor) {
          logger.warn('[FIX:pr-toolbar-lifecycle] Shadow host has no available anchor');
          return;
        }

        appendToolbar(anchor, ui.shadowHost);
        logger.info('[FIX:pr-toolbar-lifecycle] Restored detached Shadow host', {
          selector,
        });
      });
      hostObserver.observe(document.body, { childList: true, subtree: true });
      render(currentState);
    },
    remove: () => {
      hostObserver?.disconnect();
      hostObserver = null;
      ui.remove();
    },
    render,
  };
};

const toToolbarState = (response: ToolbarResponse): PRToolbarState => {
  if (response.status === 'success') {
    return { status: 'success', data: response.data };
  }

  return { status: 'error', error: response.error };
};

const getContextKey = (context: PullRequestPageContext): string => {
  return `${context.owner}/${context.repository}#${context.pullNumber}`;
};

export const mountPrToolbar = async (
  ctx: ContentScriptContext,
  options: ToolbarMountOptions = {},
) => {
  const createUi = options.createUi ?? createToolbarUi;
  const findAnchor = options.findAnchor ?? findPullRequestToolbarAnchor;
  const sendToolbarMessage = options.sendToolbarMessage ?? sendMessage;
  const openSettings = options.openSettings ?? (() => sendMessage('openOptionsPage'));
  let currentContext: PullRequestPageContext | null = null;
  let currentContextKey: string | null = null;
  let currentState: PRToolbarState = { status: 'unsupported-context' };
  let ui: ToolbarUi | null = null;
  let uiPromise: Promise<ToolbarUi> | null = null;
  let uiSequence = 0;
  let requestSequence = 0;

  const render = () => ui?.render(currentState);

  const loadToolbarData = async (context: PullRequestPageContext) => {
    const requestId = ++requestSequence;
    const contextKey = getContextKey(context);
    const correlationId = createCorrelationId();
    currentState = { status: 'loading' };
    render();
    logger.info('Loading toolbar data for page context', { contextKey });
    logger.debug('Sending toolbar data request', { requestId, correlationId });

    try {
      const response = await sendToolbarMessage('getPullRequestToolbarData', {
        context,
        correlationId,
      });

      if (requestId !== requestSequence || currentContextKey !== contextKey) {
        logger.debug('Ignored stale toolbar response', { requestId, correlationId });
        return;
      }

      currentState = toToolbarState(response);
      render();
    } catch (error) {
      if (requestId !== requestSequence || currentContextKey !== contextKey) {
        logger.debug('Ignored stale toolbar request failure', { requestId, correlationId });
        return;
      }

      const isUnavailable = isReceiverUnavailableError(error);
      const code = isUnavailable ? 'receiver-unavailable' : 'unknown-error';
      const log = isUnavailable ? logger.warn : logger.error;
      log('Toolbar data request failed', { requestId, correlationId, code });
      currentState = {
        status: 'error',
        error: {
          code,
          message: isUnavailable
            ? 'MergeLens background is unavailable'
            : 'Unable to load PR toolbar data',
        },
      };
      render();
    }
  };

  const remove = () => {
    requestSequence += 1;
    uiSequence += 1;
    currentContext = null;
    currentContextKey = null;
    uiPromise = null;
    if (!ui) {
      return;
    }

    ui.remove();
    ui = null;
    currentState = { status: 'unsupported-context' };
    logger.info('Removed PR toolbar UI');
  };

  const ensureUi = async () => {
    if (ui) {
      return;
    }

    const anchor = findAnchor();
    logger.debug('Resolved initial PR toolbar anchor', { isAvailable: Boolean(anchor) });
    if (!anchor) {
      logger.warn('PR toolbar will wait for a dynamic GitHub anchor');
    }

    const creationSequence = uiSequence;
    uiPromise ??= createUi(ctx, {
      onOpenSettings: () => {
        try {
          void Promise.resolve(openSettings()).catch((error: unknown) => {
            logger.error('Failed to open MergeLens settings', {
              errorName: error instanceof Error ? error.name : 'UnknownError',
            });
          });
        } catch (error) {
          logger.error('Failed to open MergeLens settings', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
        }
      },
      onRetry: () => {
        if (currentContext) {
          void loadToolbarData(currentContext);
        }
      },
    });
    const creationPromise = uiPromise;
    const createdUi = await creationPromise;
    if (creationSequence !== uiSequence || !currentContextKey) {
      createdUi.remove();
      if (uiPromise === creationPromise) {
        uiPromise = null;
      }
      return;
    }

    if (!ui) {
      ui = createdUi;
      ui.autoMount();
    }
    render();
    logger.info('Started PR toolbar UI mounting');
  };

  const reconcile = async (nextContext: PullRequestPageContext | null) => {
    if (!nextContext) {
      remove();
      return;
    }

    const nextContextKey = getContextKey(nextContext);
    if (currentContextKey === nextContextKey && ui) {
      logger.debug('Ignored duplicate toolbar reconciliation', {
        contextKey: nextContextKey,
      });
      return;
    }

    currentContext = nextContext;
    currentContextKey = nextContextKey;
    logger.info('Reconciling PR toolbar context', { contextKey: nextContextKey });
    await ensureUi();
    if (currentContextKey !== nextContextKey || !ui) {
      logger.debug('Skipped superseded toolbar reconciliation', {
        contextKey: nextContextKey,
      });
      return;
    }
    await loadToolbarData(nextContext);
  };

  ctx.onInvalidated(remove);
  return { reconcile, remove };
};
