import { z } from 'zod';
import type { DeploymentState, QuickLinksData } from '../domain/QuickLinks';

const deploymentSchema = z.object({
  id: z.union([z.number(), z.string()]),
  environment: z.string().nullable().optional(),
  sha: z.string().min(1),
  statuses_url: z.url(),
});

const httpsUrlSchema = z.url().refine((value) => new URL(value).protocol === 'https:');

const statusSchema = z.object({
  state: z.string(),
  target_url: httpsUrlSchema.nullable().optional(),
  environment_url: httpsUrlSchema.nullable().optional(),
  updated_at: z.iso.datetime({ offset: true }).nullable().optional(),
  created_at: z.iso.datetime({ offset: true }).nullable().optional(),
});

const stateMap: Record<string, DeploymentState> = {
  pending: 'pending',
  queued: 'pending',
  in_progress: 'pending',
  success: 'success',
  failure: 'failure',
  error: 'error',
  inactive: 'inactive',
};

export const mapQuickLinksResponse = (
  deploymentsInput: unknown,
  statusesByDeployment: ReadonlyMap<string, unknown[]>,
  configuredLinks: QuickLinksData['configuredLinks'],
): QuickLinksData => {
  const deployments = z.array(deploymentSchema).parse(deploymentsInput);
  const mapped = deployments.map((deployment) => {
    const statuses = z.array(statusSchema).parse(statusesByDeployment.get(String(deployment.id)) ?? []);
    const latest = statuses[0];
    return {
      id: String(deployment.id),
      environment: deployment.environment?.trim() || 'Deployment',
      state: latest ? (stateMap[latest.state] ?? 'unknown') : 'unknown',
      url: latest?.environment_url ?? latest?.target_url ?? null,
      updatedAt: latest?.updated_at ?? latest?.created_at ?? null,
    };
  });
  const unique = [...new Map(mapped.map((deployment) => [deployment.id, deployment])).values()];
  return { deployments: unique, configuredLinks };
};
