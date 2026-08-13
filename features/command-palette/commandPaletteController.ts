import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { observePageContext } from '@/shared/github/dom/navigation';
import { createLogger } from '@/shared/logging/logger';
import { isReceiverUnavailableError, sendMessage } from '@/shared/messaging/protocol';
import { builtInCommands, createCommandContext, createCommandRegistry } from '.';
import type { CommandContext, CommandDependencies } from './types';
import { createKeyboardController } from './keyboardController';

const logger = createLogger('commandPalette.controller');

export interface PaletteControllerUi {
  mount: () => void;
  remove: () => void;
  render: (props: {
    isOpen: boolean;
    context: CommandContext;
    onClose: () => void;
    onExecute: (commandId: Parameters<ReturnType<typeof createCommandRegistry>['execute']>[0]) => Promise<void>;
  }) => void;
}

export const createCommandPaletteController = (
  ctx: ContentScriptContext,
  ui: PaletteControllerUi,
  targetWindow: Window = window,
) => {
  const registry = createCommandRegistry(builtInCommands);
  const initialContext = createCommandContext(new URL(targetWindow.location.href));
  let isOpen = false;

  if (!initialContext) {
    logger.error('[FIX:command-palette-ts] Initial page context is not a supported GitHub URL');
    throw new Error('Command palette requires a GitHub page context');
  }

  let context: CommandContext = initialContext;

  const dependencies: CommandDependencies = {
    navigate: (url) => {
      targetWindow.location.assign(url);
    },
    openSettings: async () => {
      await sendMessage('openOptionsPage');
    },
    refreshPullRequestToolbar: async () => {
      logger.info('Requested toolbar refresh from palette');
      // The toolbar observes context changes; re-publishing is intentionally kept
      // at the entrypoint so the palette does not couple to its private controller.
    },
  };

  const close = (): void => {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    ui.render({ isOpen, context, onClose: close, onExecute });
    logger.info('Command palette closed');
  };

  const open = (): void => {
    if (isOpen) {
      return;
    }

    isOpen = true;
    ui.render({ isOpen, context, onClose: close, onExecute });
    logger.info('Command palette opened', {
      availableCount: registry.getAvailable(context).length,
    });
  };

  const onExecute = async (commandId: Parameters<typeof registry.execute>[0]): Promise<void> => {
    try {
      await registry.execute(commandId, context, dependencies);
      close();
    } catch (error) {
      if (isReceiverUnavailableError(error)) {
        logger.warn('Palette command receiver unavailable', { commandId });
      } else {
        logger.error('Palette command execution failed', {
          commandId,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
  };

  const keyboard = createKeyboardController(targetWindow, {
    open,
    close,
    isOpen: () => isOpen,
  });

  const updateContext = (nextUrl: URL): void => {
    const nextContext = createCommandContext(nextUrl);
    if (!nextContext) {
      logger.warn('Ignored unsupported palette navigation');
      close();
      return;
    }

    context = nextContext;
    if (isOpen) {
      ui.render({ isOpen, context, onClose: close, onExecute });
    }
    logger.debug('Updated palette page context', {
      hasPullRequest: context.pageContext?.kind === 'pull-request',
      hasRepository: Boolean(context.repositoryContext),
    });
  };

  observePageContext(ctx, targetWindow, () => updateContext(new URL(targetWindow.location.href)));
  keyboard.start();
  ui.mount();
  ui.render({ isOpen, context, onClose: close, onExecute });

  const remove = (): void => {
    keyboard.stop();
    ui.remove();
    logger.info('Command palette controller removed');
  };

  ctx.onInvalidated(remove);
  return { open, close, remove };
};
