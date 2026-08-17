import {
  createCommandPaletteController,
  mountCommandPaletteUi,
} from '@/features/command-palette';
import { observePageContext } from '@/shared/github/dom/navigation';
import { mountPrToolbar } from '@/features/pr-toolbar/mountPrToolbar';
import { createLogger } from '@/shared/logging/logger';
import { onMessage } from '@/shared/messaging/protocol';
import {
  getEffectiveWorkspacePreferences,
  subscribeWorkspacePreferences,
} from '@/modules/workspace-preferences';

const logger = createLogger('content');

export default defineContentScript({
  matches: ['https://github.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const toolbar = await mountPrToolbar(ctx);
    const paletteUi = await mountCommandPaletteUi(ctx);
    createCommandPaletteController(ctx, paletteUi, window, {
      openLocalReviewWorkspace: toolbar.openLocalReviewWorkspace,
      refreshPullRequestToolbar: toolbar.refresh,
      registerOpenRequest: (open) =>
        onMessage('openCommandPalette', () => {
          logger.info('[FIX:command-palette-popup] Opening palette from extension popup');
          open();
          return { status: 'success' };
        }),
      resolveWorkspacePreferences: async (commandContext) => {
        const repositoryKey = commandContext.repositoryContext
          ? `${commandContext.repositoryContext.owner}/${commandContext.repositoryContext.repository}`
          : null;
        return getEffectiveWorkspacePreferences(repositoryKey);
      },
      subscribeWorkspacePreferences: (refresh) =>
        subscribeWorkspacePreferences((category) => {
          if (category !== 'saved-filters') refresh();
        }),
    });
    observePageContext(ctx, window, (context) => {
      void toolbar.reconcile(context);
    });
    logger.info('Initialized GitHub content surfaces');
  },
});
