import type { PullRequestToolbarData } from '../domain/PullRequestSummary'

export interface ReadPullRequestInput {
  owner: string
  repository: string
  pullNumber: number
}

export type PullRequestReadErrorCode =
  | 'missing-token'
  | 'unauthorized'
  | 'rate-limited'
  | 'network-error'
  | 'invalid-response'
  | 'unknown-error'

export type PullRequestReadResult =
  | { status: 'success'; data: PullRequestToolbarData }
  | {
      status: 'error'
      error: {
        code: PullRequestReadErrorCode
        message: string
        retryAfterSeconds?: number
      }
    }

export interface PullRequestReader {
  read(input: ReadPullRequestInput): Promise<PullRequestReadResult>
}
