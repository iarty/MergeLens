import { describe, expect, it } from 'vitest';
import { estimatePullRequest } from '@/modules/pull-request-estimation';

describe('estimatePullRequest', () => {
  it('returns a deterministic explainable score for changed files and checks', () => {
    const result = estimatePullRequest({
      files: [{ path: 'src/app.ts', additions: 100, deletions: 20, changes: 120, isGenerated: false }],
      checks: [{ status: 'failure' }],
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.counts).toMatchObject({ files: 1, additions: 100, deletions: 20 });
    expect(result.breakdown.checks).toBeGreaterThan(0);
    expect(result.uncertain).toBe(false);
  });

  it('marks empty and truncated input as uncertain', () => {
    expect(estimatePullRequest({ files: [], checks: [] }).uncertain).toBe(true);
    expect(estimatePullRequest({
      files: [],
      checks: [],
      truncated: { files: true, checks: false },
    }).uncertain).toBe(true);
  });

  it('falls back to bounded values for invalid overrides', () => {
    const result = estimatePullRequest({
      files: [{ path: 'generated.lock', additions: 1, deletions: 1, changes: 2, isGenerated: true }],
      checks: [],
      heuristics: {
        weights: { changes: -1 },
        thresholds: { medium: 99, high: 1, critical: 2 },
      },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high', 'critical']).toContain(result.band);
  });
});
