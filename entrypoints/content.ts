import {
  createCommandPaletteController,
  mountCommandPaletteUi,
} from '@/features/command-palette';
import { observePageContext } from '@/shared/github/dom/navigation';
import { mountPrToolbar } from '@/features/pr-toolbar/mountPrToolbar';
import { createLogger } from '@/shared/logging/logger';
import { onMessage } from '@/shared/messaging/protocol';

const logger = createLogger('content');

export default defineContentScript({
  matches: ['https://github.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const toolbar = await mountPrToolbar(ctx);
    const paletteUi = await mountCommandPaletteUi(ctx);
    createCommandPaletteController(ctx, paletteUi, window, {
      refreshPullRequestToolbar: toolbar.refresh,
      registerOpenRequest: (open) =>
        onMessage('openCommandPalette', () => {
          logger.info('[FIX:command-palette-popup] Opening palette from extension popup');
          open();
          return { status: 'success' };
        }),
    });
    observePageContext(ctx, window, (context) => {
      void toolbar.reconcile(context);
    });
    logger.info('Initialized GitHub content surfaces');
  },
});
