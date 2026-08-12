export type CheckStatus =
  | 'queued'
  | 'in-progress'
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'skipped'
  | 'timed-out'
  | 'action-required'
  | 'unknown';

export interface CheckSummary {
  id: string;
  name: string;
  status: CheckStatus;
  detailsUrl: string | null;
}
