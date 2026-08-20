import type { CheckStatus } from '@/modules/pull-requests'

export type PullRequestEstimationBand = 'low' | 'medium' | 'high' | 'critical'

export interface PullRequestFileSummary {
  path: string
  additions: number
  deletions: number
  changes: number
  isGenerated: boolean
}

export interface PullRequestCheckRiskSummary {
  total: number
  failing: number
  inProgress: number
  unknown: number
}

export interface PullRequestEstimationInput {
  files: readonly PullRequestFileSummary[]
  checks: readonly { status: CheckStatus }[]
  truncated?: PullRequestEstimationTruncation
}

export interface PullRequestEstimationTruncation {
  files: boolean
  checks: boolean
  fileLimit?: number
  checkLimit?: number
}

export interface PullRequestEstimationWeights {
  changes: number
  files: number
  generatedFiles: number
  checks: number
}

export interface PullRequestEstimationThresholds {
  medium: number
  high: number
  critical: number
}

export interface PullRequestEstimationHeuristics {
  version: string
  weights: PullRequestEstimationWeights
  thresholds: PullRequestEstimationThresholds
  maxChangeCount: number
  maxFileCount: number
  generatedFilePatterns: readonly string[]
}

export const DEFAULT_PULL_REQUEST_ESTIMATION_HEURISTICS: PullRequestEstimationHeuristics =
  {
    version: 'v1',
    weights: { changes: 0.45, files: 0.25, generatedFiles: 0.1, checks: 0.2 },
    thresholds: { medium: 30, high: 60, critical: 80 },
    maxChangeCount: 1000,
    maxFileCount: 50,
    generatedFilePatterns: [
      '*.lock',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
    ],
  }

export interface PullRequestEstimationBreakdown {
  changes: number
  files: number
  generatedFiles: number
  checks: number
}

export interface PullRequestEstimationResult {
  score: number
  band: PullRequestEstimationBand
  breakdown: PullRequestEstimationBreakdown
  counts: {
    files: number
    generatedFiles: number
    additions: number
    deletions: number
    checks: PullRequestCheckRiskSummary
  }
  uncertain: boolean
  truncation: PullRequestEstimationTruncation
  heuristicsVersion: string
}
