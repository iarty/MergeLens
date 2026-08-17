import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createLogger } from '@/shared/logging/logger';
import {
  isReceiverUnavailableError,
  sendMessage,
} from '@/shared/messaging/protocol';
import { createCommandRegistry } from './commandRegistry';
import { builtInCommands } from './commands/builtInCommands';
import { createCommandContext } from './commands/context';
import type { CommandContext, CommandDependencies } from './types';
import type { CommandId } from './types';
import { createKeyboardController } from './keyboardController';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  type EffectiveWorkspacePreferences,
} from '@/modules/workspace-preferences';

const logger = createLogger('commandPalette.controller');
const activeControllers = new WeakMap<Window, CommandPaletteController>();

export interface PaletteControllerUi {
  mount: () => void;
  remove: () => void;
  render: (props: {
    isOpen: boolean;
    context: CommandContext;
    onClose: () => void;
    onExecute: (commandId: CommandId) => Promise<void>;
    returnFocus: HTMLElement | null;
  }) => void;
}

export interface CommandPaletteControllerOptions {
  navigate?: (url: string) => void;
  openLocalReviewWorkspace?: () => Promise<void>;
  openSettings?: () => Promise<void>;
  refreshPullRequestToolbar?: () => Promise<void>;
  registerOpenRequest?: (open: () => void) => () => void;
  resolveWorkspacePreferences?: (
    context: CommandContext,
  ) => Promise<EffectiveWorkspacePreferences>;
}

export interface CommandPaletteController {
  open: () => void;
  close: () => void;
  remove: () => void;
}

export const createCommandPaletteController = (
  ctx: ContentScriptContext,
  ui: PaletteControllerUi,
  targetWindow: Window = window,
  options: CommandPaletteControllerOptions = {},
): CommandPaletteController => {
  const existingController = activeControllers.get(targetWindow);
  if (existingController) {
    logger.warn('Ignored duplicate command palette initialization');
    return existingController;
  }

  const registry = createCommandRegistry(builtInCommands);
  const initialContext = createCommandContext(new URL(targetWindow.location.href));
  let isOpen = false;
  let opener: HTMLElement | null = null;

  if (!initialContext) {
    logger.error('[FIX:command-palette-ts] Initial page context is not a supported GitHub URL');
    throw new Error('Command palette requires a GitHub page context');
  }

  let context: CommandContext = initialContext;
  let workspacePreferences = DEFAULT_WORKSPACE_PREFERENCES;

  const dependencies: CommandDependencies = {
    navigate: options.navigate ?? ((url) => {
      targetWindow.location.assign(url);
    }),
    openSettings: options.openSettings ?? (async () => {
      await sendMessage('openOptionsPage');
    }),
    openLocalReviewWorkspace: options.openLocalReviewWorkspace ?? (async () => {
      logger.warn('Local review workspace callback is unavailable');
    }),
    refreshPullRequestToolbar: options.refreshPullRequestToolbar ?? (async () => {
      logger.warn('Toolbar refresh callback is unavailable');
    }),
  };

  const close = (): void => {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    ui.render({ isOpen, context, onClose: close, onExecute, returnFocus: opener });
    logger.info('Command palette closed');
  };

  const open = (): void => {
    if (isOpen) {
      return;
    }

    opener = targetWindow.document.activeElement instanceof HTMLElement
      ? targetWindow.document.activeElement
      : null;
    isOpen = true;
    ui.render({ isOpen, context, onClose: close, onExecute, returnFocus: opener });
    logger.info('Command palette opened', {
      availableCount: registry.getAvailable(context).length,
    });
  };

  const onExecute = async (commandId: CommandId): Promise<void> => {
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
    getShortcut: () => workspacePreferences.featureFlags.customCommandPaletteShortcut
      ? workspacePreferences.commandPaletteShortcut
      : DEFAULT_WORKSPACE_PREFERENCES.commandPaletteShortcut,
  });

  const refreshWorkspacePreferences = async (): Promise<void> => {
    if (!options.resolveWorkspacePreferences) {
      logger.debug('Workspace preference resolver unavailable; using defaults', {
        hasRepositoryContext: Boolean(context.repositoryContext),
      });
      return;
    }

    try {
      workspacePreferences = await options.resolveWorkspacePreferences(context);
      logger.debug('Applied workspace preference snapshot to command palette', {
        hasRepositoryContext: Boolean(context.repositoryContext),
        customShortcutEnabled:
          workspacePreferences.featureFlags.customCommandPaletteShortcut,
      });
    } catch (error) {
      workspacePreferences = DEFAULT_WORKSPACE_PREFERENCES;
      logger.warn('Using default command palette preferences after resolver failure', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  };

  const updateContext = (nextUrl: URL): void => {
    const nextContext = createCommandContext(nextUrl);
    if (!nextContext) {
      logger.warn('Ignored unsupported palette navigation');
      close();
      return;
    }

    context = nextContext;
    void refreshWorkspacePreferences();
    if (isOpen) {
      ui.render({ isOpen, context, onClose: close, onExecute, returnFocus: opener });
    }
    logger.debug('Updated palette page context', {
      hasPullRequest: context.pageContext?.kind === 'pull-request',
      hasRepository: Boolean(context.repositoryContext),
    });
  };

  ctx.addEventListener(targetWindow, 'wxt:locationchange', ({ newUrl }) => {
    updateContext(newUrl);
  });
  keyboard.start();
  void refreshWorkspacePreferences();
  const removeOpenMessageListener = options.registerOpenRequest?.(open) ?? (() => {});
  ui.mount();
  ui.render({ isOpen, context, onClose: close, onExecute, returnFocus: opener });

  const remove = (): void => {
    removeOpenMessageListener();
    keyboard.stop();
    ui.remove();
    activeControllers.delete(targetWindow);
    logger.info('Command palette controller removed');
  };

  const controller = { open, close, remove };
  activeControllers.set(targetWindow, controller);
  ctx.onInvalidated(remove);
  return controller;
};
