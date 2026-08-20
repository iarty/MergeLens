import type { CommandPaletteShortcutId } from '@/modules/workspace-preferences'
import type { CommandShortcut } from './types'

const COMMAND_SHORTCUTS: Readonly<
  Record<CommandPaletteShortcutId, CommandShortcut>
> = {
  'primary-k': {
    id: 'primary-k',
    key: 'k',
    modifiers: ['primary'],
    label: 'Ctrl / Cmd K',
  },
  'primary-shift-k': {
    id: 'primary-shift-k',
    key: 'k',
    modifiers: ['primary', 'shift'],
    label: 'Ctrl / Cmd Shift K',
  },
  'primary-shift-p': {
    id: 'primary-shift-p',
    key: 'p',
    modifiers: ['primary', 'shift'],
    label: 'Ctrl / Cmd Shift P',
  },
}

export const DEFAULT_COMMAND_SHORTCUT = COMMAND_SHORTCUTS['primary-k']

export const getCommandShortcut = (
  shortcutId: unknown,
): CommandShortcut | null => {
  if (typeof shortcutId !== 'string') return null
  return COMMAND_SHORTCUTS[shortcutId as CommandPaletteShortcutId] ?? null
}

export const isSupportedCommandShortcut = (
  shortcut: CommandShortcut,
): boolean => {
  const canonical = getCommandShortcut(shortcut.id)
  return (
    canonical !== null &&
    canonical.key === shortcut.key &&
    canonical.label === shortcut.label &&
    canonical.modifiers.length === shortcut.modifiers.length &&
    canonical.modifiers.every(
      (modifier, index) => modifier === shortcut.modifiers[index],
    )
  )
}
