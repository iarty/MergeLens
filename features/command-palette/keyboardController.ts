import { createLogger } from '@/shared/logging/logger';

const logger = createLogger('commandPalette.keyboard');

export interface KeyboardControllerCallbacks {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.matches('input, textarea, select, [contenteditable="true"]')
  );
};
export const isPaletteShortcut = (event: KeyboardEvent): boolean => {
  const isK = event.key.toLowerCase() === 'k';
  const hasPrimaryModifier = event.metaKey || event.ctrlKey;
  const hasConflictingModifier = event.altKey || event.shiftKey;
  return isK && hasPrimaryModifier && !hasConflictingModifier;
};

export const createKeyboardController = (
  target: Window,
  callbacks: KeyboardControllerCallbacks,
) => {
  let started = false;

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && callbacks.isOpen()) {
      logger.info('Closing palette from Escape');
      event.preventDefault();
      callbacks.close();
      return;
    }

    if (!isPaletteShortcut(event)) {
      return;
    }

    if (isEditableTarget(event.target)) {
      logger.warn('Ignored palette shortcut from editable target');
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    logger.info('Opening palette from keyboard shortcut');
    callbacks.open();
  };

  return {
    start: (): void => {
      if (started) {
        logger.warn('Ignored duplicate keyboard controller start');
        return;
      }

      target.addEventListener('keydown', handleKeyDown, true);
      started = true;
      logger.debug('Keyboard controller started');
    },
    stop: (): void => {
      if (!started) {
        return;
      }

      target.removeEventListener('keydown', handleKeyDown, true);
      started = false;
      logger.debug('Keyboard controller stopped');
    },
  };
};
