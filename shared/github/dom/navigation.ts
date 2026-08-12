import type { PullRequestPageContext } from '../context/PageContext';
import { parsePageContext } from '../context/parsePageContext';
import { createLogger } from '@/shared/logging/logger';

const logger = createLogger('github.dom.navigation');

export interface LocationChangeDetail {
  newUrl: URL;
}

interface ContentScriptEventContext {
  addEventListener(
    target: Window,
    type: 'wxt:locationchange',
    listener: (event: LocationChangeDetail) => void,
  ): void;
}

export type PageContextChangeHandler = (
  context: PullRequestPageContext | null,
) => void;

export const observePageContext = (
  context: ContentScriptEventContext,
  targetWindow: Window,
  handler: PageContextChangeHandler,
): void => {
  let previousContextKey: string | null | undefined;

  const publishContext = (url: URL) => {
    const pageContext = parsePageContext(url);
    const nextContextKey = pageContext
      ? `${pageContext.owner}/${pageContext.repository}#${pageContext.pullNumber}`
      : null;

    if (nextContextKey === previousContextKey) {
      logger.debug('Ignored duplicate page context', { contextKey: nextContextKey });
      return;
    }

    previousContextKey = nextContextKey;
    logger.info('Page context changed', { contextKey: nextContextKey });
    handler(pageContext);
  };

  publishContext(new URL(targetWindow.location.href));
  context.addEventListener(targetWindow, 'wxt:locationchange', ({ newUrl }) => {
    publishContext(newUrl);
  });
};
