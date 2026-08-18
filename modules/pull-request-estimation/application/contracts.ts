import type {
  PullRequestEstimationHeuristics,
  PullRequestEstimationInput,
  PullRequestEstimationResult,
} from '../domain/PullRequestEstimation';

export type PullRequestEstimationHeuristicsOverrides =
  Omit<Partial<PullRequestEstimationHeuristics>, 'weights' | 'thresholds'> & {
    weights?: Partial<PullRequestEstimationHeuristics['weights']>;
    thresholds?: Partial<PullRequestEstimationHeuristics['thresholds']>;
  };

export interface EstimatePullRequestInput extends PullRequestEstimationInput {
  heuristics?: PullRequestEstimationHeuristicsOverrides;
}

export type EstimatePullRequest = (
  input: EstimatePullRequestInput,
) => PullRequestEstimationResult;
