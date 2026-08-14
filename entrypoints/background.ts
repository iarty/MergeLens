import {
  createGetReviewInbox,
  createGetPullRequestToolbarData,
  OctokitReviewInboxReader,
  OctokitPullRequestReader,
} from '@/modules/pull-requests';
import {
  createGetPullRequestQuickLinks,
  OctokitQuickLinksReader,
} from '@/modules/quick-links';
import { readConfiguredQuickLinks } from '@/modules/quick-links/settings';
import { createLogger } from '@/shared/logging/logger';
import { onMessage } from '@/shared/messaging/protocol';

const logger = createLogger('background');

export default defineBackground(() => {
  const getPullRequestToolbarData = createGetPullRequestToolbarData(
    new OctokitPullRequestReader(),
  );
  const getReviewInbox = createGetReviewInbox(new OctokitReviewInboxReader());
  const getPullRequestQuickLinks = createGetPullRequestQuickLinks(
    new OctokitQuickLinksReader(undefined, undefined, readConfiguredQuickLinks),
  );

  onMessage('getPullRequestToolbarData', ({ data }) => {
    return getPullRequestToolbarData(data);
  });

  onMessage('getReviewInbox', ({ data }) => {
    return getReviewInbox(data);
  });

  onMessage('getPullRequestQuickLinks', ({ data }) => {
    return getPullRequestQuickLinks(data);
  });

  onMessage('openOptionsPage', async () => {
    logger.info('Opening MergeLens options page');
    await browser.runtime.openOptionsPage();
    return { status: 'success' };
  });

  logger.info('MergeLens background listeners registered', {
    extensionId: browser.runtime.id,
  });
});
