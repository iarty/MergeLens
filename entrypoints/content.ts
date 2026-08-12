import { observePageContext } from '@/shared/github/dom/navigation';
import { mountPrToolbar } from '@/features/pr-toolbar/mountPrToolbar';

export default defineContentScript({
  matches: ['https://github.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const toolbar = await mountPrToolbar(ctx);
    observePageContext(ctx, window, (context) => {
      void toolbar.reconcile(context);
    });
  },
});
