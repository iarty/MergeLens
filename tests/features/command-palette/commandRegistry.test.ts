import { describe, expect, it, vi } from 'vitest'
import { createCommandRegistry } from '@/features/command-palette/commandRegistry'
import { builtInCommands } from '@/features/command-palette/commands/builtInCommands'
import { createCommandContext } from '@/features/command-palette/commands/context'
import type {
  Command,
  CommandDependencies,
} from '@/features/command-palette/types'

const createDependencies = (): CommandDependencies => ({
  navigate: vi.fn(),
  openLocalReviewWorkspace: vi.fn().mockResolvedValue(undefined),
  openSettings: vi.fn().mockResolvedValue(undefined),
  refreshPullRequestToolbar: vi.fn().mockResolvedValue(undefined),
})

describe('createCommandRegistry', () => {
  it('filters commands by context while preserving registration order', () => {
    const context = createCommandContext(
      'https://github.com/facebook/react/pull/42',
    )
    const registry = createCommandRegistry(builtInCommands)

    expect(context).not.toBeNull()
    expect(registry.getAvailable(context!).map(({ id }) => id)).toEqual([
      'open-current-pull-request',
      'open-repository',
      'open-actions',
      'open-local-review-workspace',
      'open-settings',
      'refresh-pull-request-toolbar',
    ])
  })

  it('searches titles and keywords case-insensitively', () => {
    const context = createCommandContext('https://github.com/facebook/react')
    const registry = createCommandRegistry(builtInCommands)

    expect(registry.search('CI', context!).map(({ id }) => id)).toEqual([
      'open-actions',
    ])
    expect(registry.search('SETTINGS', context!).map(({ id }) => id)).toEqual([
      'open-settings',
    ])
  })

  it('only exposes the local review workspace command on pull requests', () => {
    const repositoryContext = createCommandContext(
      'https://github.com/facebook/react',
    )
    const pullRequestContext = createCommandContext(
      'https://github.com/facebook/react/pull/42',
    )
    const registry = createCommandRegistry(builtInCommands)

    expect(
      registry.getAvailable(repositoryContext!).map(({ id }) => id),
    ).not.toContain('open-local-review-workspace')
    expect(
      registry.getAvailable(pullRequestContext!).map(({ id }) => id),
    ).toContain('open-local-review-workspace')
  })

  it('rejects duplicate command IDs', () => {
    const duplicate = builtInCommands[0] as Command

    expect(() => createCommandRegistry([duplicate, duplicate])).toThrow(
      'Duplicate command ID',
    )
  })

  it('executes navigation and delegated commands through injected dependencies', async () => {
    const context = createCommandContext(
      'https://github.com/facebook/react/pull/42',
    )
    const dependencies = createDependencies()
    const registry = createCommandRegistry(builtInCommands)

    await registry.execute('open-actions', context!, dependencies)
    await registry.execute(
      'open-local-review-workspace',
      context!,
      dependencies,
    )
    await registry.execute('open-settings', context!, dependencies)
    await registry.execute(
      'refresh-pull-request-toolbar',
      context!,
      dependencies,
    )

    expect(dependencies.navigate).toHaveBeenCalledWith(
      'https://github.com/facebook/react/actions',
    )
    expect(dependencies.openSettings).toHaveBeenCalledOnce()
    expect(dependencies.openLocalReviewWorkspace).toHaveBeenCalledOnce()
    expect(dependencies.refreshPullRequestToolbar).toHaveBeenCalledOnce()
  })

  it('rejects a command that became unavailable', async () => {
    const context = createCommandContext('https://github.com/settings/profile')
    const registry = createCommandRegistry(builtInCommands)

    await expect(
      registry.execute('open-actions', context!, createDependencies()),
    ).rejects.toThrow('Command is unavailable')
  })
})
