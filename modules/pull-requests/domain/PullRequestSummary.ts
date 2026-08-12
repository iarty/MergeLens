import type { CheckSummary } from './CheckSummary';

export interface PullRequestSummary {
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  isDraft: boolean;
  authorLogin: string | null;
}

export interface PullRequestToolbarData {
  pullRequest: PullRequestSummary;
  checks: CheckSummary[];
  actionsUrl: string;
}
