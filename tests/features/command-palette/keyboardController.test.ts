import { describe, expect, it, vi } from 'vitest';
import { createKeyboardController } from '@/features/command-palette/keyboardController';

describe('command palette keyboard controller', () => {
  it('opens on Ctrl/Cmd+K and closes on Escape', () => {
    const open = vi.fn();
    const close = vi.fn();
    let isOpen = false;
    const controller = createKeyboardController(window, {
      open: () => { isOpen = true; open(); },
      close: () => { isOpen = false; close(); },
      isOpen: () => isOpen,
    });
    controller.start();

    const shortcut = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(shortcut);
    expect(open).toHaveBeenCalledOnce();
    expect(shortcut.defaultPrevented).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(close).toHaveBeenCalledOnce();
    controller.stop();
  });

  it('ignores shortcuts while typing', () => {
    const open = vi.fn();
    const input = document.createElement('input');
    document.body.append(input);
    const controller = createKeyboardController(window, {
      open,
      close: vi.fn(),
      isOpen: () => false,
    });
    controller.start();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    expect(open).not.toHaveBeenCalled();
    controller.stop();
    input.remove();
  });
});
