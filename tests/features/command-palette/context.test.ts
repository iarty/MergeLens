import { describe, expect, it } from 'vitest'
import {
  createCommandContext,
  hasPullRequestContext,
  hasRepositoryContext,
} from '@/features/command-palette/commands/context'

describe('command palette context', () => {
  it('classifies a pull request page with its repository', () => {
    const context = createCommandContext(
      'https://github.com/facebook/react/pull/42/files',
    )

    expect(context).toMatchObject({
      repositoryContext: { owner: 'facebook', repository: 'react' },
      pageContext: { kind: 'pull-request', pullNumber: 42 },
    })
    expect(context && hasPullRequestContext(context)).toBe(true)
    expect(context && hasRepositoryContext(context)).toBe(true)
  })

  it('classifies a repository page without inventing a pull request', () => {
    const context = createCommandContext(
      'https://github.com/facebook/react/issues',
    )

    expect(context?.repositoryContext).toEqual({
      owner: 'facebook',
      repository: 'react',
    })
    expect(context?.pageContext).toBeNull()
    expect(context && hasRepositoryContext(context)).toBe(true)
  })

  it('keeps generic GitHub pages supported without a repository context', () => {
    const context = createCommandContext('https://github.com/settings/profile')

    expect(context).toMatchObject({
      repositoryContext: null,
      pageContext: null,
    })
  })

  it('rejects malformed and non-GitHub contexts', () => {
    expect(createCommandContext('not-a-url')).toBeNull()
    expect(
      createCommandContext('https://example.com/facebook/react'),
    ).toBeNull()
    expect(createCommandContext('http://github.com/facebook/react')).toBeNull()
  })
})
