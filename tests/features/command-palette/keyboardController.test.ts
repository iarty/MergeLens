import { describe, expect, it, vi } from 'vitest'
import { createKeyboardController } from '@/features/command-palette/keyboardController'
import { getCommandShortcut } from '@/features/command-palette'

describe('command palette keyboard controller', () => {
  it('opens on Ctrl/Cmd+K and closes on Escape', () => {
    const open = vi.fn()
    const close = vi.fn()
    let isOpen = false
    const controller = createKeyboardController(window, {
      open: () => {
        isOpen = true
        open()
      },
      close: () => {
        isOpen = false
        close()
      },
      isOpen: () => isOpen,
    })
    controller.start()

    const shortcut = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(shortcut)
    expect(open).toHaveBeenCalledOnce()
    expect(shortcut.defaultPrevented).toBe(true)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    expect(close).toHaveBeenCalledOnce()
    controller.stop()
  })

  it('ignores shortcuts while typing', () => {
    const open = vi.fn()
    const input = document.createElement('input')
    document.body.append(input)
    const controller = createKeyboardController(window, {
      open,
      close: vi.fn(),
      isOpen: () => false,
    })
    controller.start()

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    )
    expect(open).not.toHaveBeenCalled()
    controller.stop()
    input.remove()
  })

  it('does not claim modified or duplicate shortcuts', () => {
    const open = vi.fn()
    const controller = createKeyboardController(window, {
      open,
      close: vi.fn(),
      isOpen: () => false,
    })
    controller.start()
    controller.start()

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        cancelable: true,
      }),
    )
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        cancelable: true,
      }),
    )

    expect(open).not.toHaveBeenCalled()
    controller.stop()
  })

  it.each([
    ['primary-shift-k', 'k'],
    ['primary-shift-p', 'p'],
  ] as const)('opens with supported shortcut %s', (shortcutId, key) => {
    const open = vi.fn()
    const shortcut = getCommandShortcut(shortcutId)!
    const controller = createKeyboardController(
      window,
      {
        open,
        close: vi.fn(),
        isOpen: () => false,
      },
      shortcut,
    )
    controller.start()

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        ctrlKey: true,
        shiftKey: true,
        cancelable: true,
      }),
    )

    expect(open).toHaveBeenCalledOnce()
    controller.stop()
  })

  it('updates the active shortcut without duplicating its listener', () => {
    const open = vi.fn()
    const controller = createKeyboardController(window, {
      open,
      close: vi.fn(),
      isOpen: () => false,
    })
    controller.start()

    expect(
      controller.updateShortcut(getCommandShortcut('primary-shift-p')!),
    ).toBe(true)
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        cancelable: true,
      }),
    )
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        shiftKey: true,
        cancelable: true,
      }),
    )

    expect(open).toHaveBeenCalledOnce()
    controller.stop()
  })

  it('rejects non-canonical shortcuts and conflicting primary modifiers', () => {
    const open = vi.fn()
    const controller = createKeyboardController(window, {
      open,
      close: vi.fn(),
      isOpen: () => false,
    })
    controller.start()

    expect(
      controller.updateShortcut({
        id: 'primary-k',
        key: 'k',
        modifiers: ['primary'],
        label: 'Untrusted',
      }),
    ).toBe(false)
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        metaKey: true,
        cancelable: true,
      }),
    )

    expect(open).not.toHaveBeenCalled()
    controller.stop()
  })

  it('falls back to the default shortcut for invalid initial metadata', () => {
    const open = vi.fn()
    const controller = createKeyboardController(
      window,
      {
        open,
        close: vi.fn(),
        isOpen: () => false,
      },
      {
        id: 'primary-shift-p',
        key: 'p',
        modifiers: ['primary'],
        label: 'Invalid metadata',
      },
    )
    controller.start()

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        cancelable: true,
      }),
    )
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        cancelable: true,
      }),
    )

    expect(open).toHaveBeenCalledOnce()
    controller.stop()
  })
})
