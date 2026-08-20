import { describe, expect, it } from 'vitest'
import {
  findPullRequestToolbarAnchor,
  resolvePullRequestToolbarAnchorSelector,
} from '@/shared/github/dom/selectors'

describe('findPullRequestToolbarAnchor', () => {
  it('resolves the semantic PageHeader used by current GitHub PR pages', () => {
    document.body.innerHTML = `
      <main>
        <div data-component="PageHeader">
          <h1>Pull request title</h1>
        </div>
      </main>
    `

    expect(findPullRequestToolbarAnchor()).toBe(
      document.querySelector('[data-component="PageHeader"]'),
    )
  })

  it('prefers the specific sticky metadata anchor over the header fallback', () => {
    document.body.innerHTML = `
      <div data-component="PageHeader"><h1>Pull request title</h1></div>
      <div data-testid="issue-metadata-sticky"></div>
    `

    expect(findPullRequestToolbarAnchor()).toBe(
      document.querySelector('[data-testid="issue-metadata-sticky"]'),
    )
  })

  it('uses the stable split layout header before the replaceable PageHeader', () => {
    document.body.innerHTML = `
      <header data-component="SplitPageLayout.Header">
        <div data-component="PageHeader"><h1>Pull request title</h1></div>
      </header>
    `

    expect(findPullRequestToolbarAnchor()).toBe(
      document.querySelector('[data-component="SplitPageLayout.Header"]'),
    )
  })

  it('prefers the stable PR container over replaceable layout headers', () => {
    document.body.innerHTML = `
      <main id="diff-comparison-viewer-container">
        <header data-component="SplitPageLayout.Header">
          <div data-component="PageHeader"><h1>Pull request title</h1></div>
        </header>
      </main>
    `

    expect(findPullRequestToolbarAnchor()).toBe(
      document.querySelector('#diff-comparison-viewer-container'),
    )
    expect(resolvePullRequestToolbarAnchorSelector()).toBe(
      '#diff-comparison-viewer-container',
    )
  })

  it('does not select unrelated PageHeader components without a title', () => {
    document.body.innerHTML = '<div data-component="PageHeader"></div>'

    expect(findPullRequestToolbarAnchor()).toBeNull()
  })
})
