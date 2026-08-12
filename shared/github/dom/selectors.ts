import { createLogger } from '@/shared/logging/logger';

const logger = createLogger('github.dom.selectors');

export const PR_TOOLBAR_ANCHOR_SELECTORS = [
  '[data-testid="issue-metadata-sticky"]',
  '.gh-header-actions',
  '.gh-header-meta',
] as const;

export const findPullRequestToolbarAnchor = (
  root: ParentNode = document,
): Element | null => {
  for (const selector of PR_TOOLBAR_ANCHOR_SELECTORS) {
    const anchor = root.querySelector(selector);
    if (anchor) {
      logger.debug('Resolved PR toolbar anchor', { selector });
      return anchor;
    }
  }

  logger.warn('PR toolbar anchor is unavailable');
  return null;
};
