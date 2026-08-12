import { z } from 'zod';

export const pullRequestContextSchema = z.object({
  kind: z.literal('pull-request'),
  owner: z.string().min(1),
  repository: z.string().min(1),
  pullNumber: z.number().int().positive(),
  url: z.url(),
});

export const toolbarRequestSchema = z.object({
  context: pullRequestContextSchema,
  correlationId: z.string().min(1).max(128),
});

export const openOptionsPageResponseSchema = z.object({
  status: z.literal('success'),
});

export const checkStatusSchema = z.enum([
  'queued',
  'in-progress',
  'success',
  'failure',
  'neutral',
  'cancelled',
  'skipped',
  'timed-out',
  'action-required',
  'unknown',
]);

export const checkSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: checkStatusSchema,
  detailsUrl: z.url().nullable(),
});

export const pullRequestSummarySchema = z.object({
  title: z.string(),
  url: z.url(),
  state: z.enum(['open', 'closed', 'merged']),
  isDraft: z.boolean(),
  authorLogin: z.string().nullable(),
});

export const toolbarDataSchema = z.object({
  pullRequest: pullRequestSummarySchema,
  checks: z.array(checkSummarySchema),
  actionsUrl: z.url(),
});

export const toolbarErrorCodeSchema = z.enum([
  'invalid-request',
  'missing-token',
  'unauthorized',
  'rate-limited',
  'network-error',
  'invalid-response',
  'receiver-unavailable',
  'unknown-error',
]);

export const toolbarResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    correlationId: z.string().min(1),
    data: toolbarDataSchema,
  }),
  z.object({
    status: z.literal('error'),
    correlationId: z.string().min(1),
    error: z.object({
      code: toolbarErrorCodeSchema,
      message: z.string().min(1),
      retryAfterSeconds: z.number().int().nonnegative().optional(),
    }),
  }),
]);

export type ToolbarRequest = z.infer<typeof toolbarRequestSchema>;
export type ToolbarResponse = z.infer<typeof toolbarResponseSchema>;
export type ToolbarData = z.infer<typeof toolbarDataSchema>;
export type ToolbarErrorCode = z.infer<typeof toolbarErrorCodeSchema>;
export type OpenOptionsPageResponse = z.infer<typeof openOptionsPageResponseSchema>;
