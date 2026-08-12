import {
  createGetPullRequestToolbarData,
  OctokitPullRequestReader,
} from '@/modules/pull-requests';
import { createLogger } from '@/shared/logging/logger';
import { onMessage } from '@/shared/messaging/protocol';

const logger = createLogger('background');

export default defineBackground(() => {
  const getPullRequestToolbarData = createGetPullRequestToolbarData(
    new OctokitPullRequestReader(),
  );

  onMessage('getPullRequestToolbarData', ({ data }) => {
    return getPullRequestToolbarData(data);
  });

  logger.info('MergeLens background listeners registered', {
    extensionId: browser.runtime.id,
  });
});
