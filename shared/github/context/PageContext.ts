export interface PullRequestPageContext {
  kind: 'pull-request'
  owner: string
  repository: string
  pullNumber: number
  url: string
}

export type PageContext = PullRequestPageContext
