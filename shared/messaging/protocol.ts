import { defineExtensionMessaging } from '@webext-core/messaging';
import { createLogger } from '@/shared/logging/logger';
import {
  reviewInboxRequestSchema,
  reviewInboxResponseSchema,
  toolbarRequestSchema,
  toolbarResponseSchema,
  type OpenOptionsPageResponse,
  type ReviewInboxRequest,
  type ReviewInboxResponse,
  type ToolbarRequest,
  type ToolbarResponse,
} from './schemas';

const logger = createLogger('messaging');

export interface MergeLensProtocolMap {
  getPullRequestToolbarData(data: ToolbarRequest): ToolbarResponse;
  getReviewInbox(data: ReviewInboxRequest): ReviewInboxResponse;
  openOptionsPage(): OpenOptionsPageResponse;
}

export const { onMessage, removeAllListeners, sendMessage } =
  defineExtensionMessaging<MergeLensProtocolMap>({
    logger: {
      debug: (...args) => logger.debug('Message debug event', { args }),
      log: (...args) => logger.info('Message lifecycle event', { args }),
      warn: (...args) => logger.warn('Message warning', { args }),
      error: (...args) => logger.error('Message failure', { args }),
    },
    throwOnUnknownMessageFormat: false,
  });

export const parseToolbarRequest = (input: unknown): ToolbarRequest => {
  const result = toolbarRequestSchema.safeParse(input);
  if (!result.success) {
    logger.warn('Rejected invalid toolbar request', {
      issueCount: result.error.issues.length,
    });
    throw new Error('Invalid PR toolbar request');
  }

  logger.debug('Validated toolbar request', {
    correlationId: result.data.correlationId,
    owner: result.data.context.owner,
    repository: result.data.context.repository,
    pullNumber: result.data.context.pullNumber,
  });
  return result.data;
};

export const parseToolbarResponse = (input: unknown): ToolbarResponse => {
  const result = toolbarResponseSchema.safeParse(input);
  if (!result.success) {
    logger.warn('Rejected invalid toolbar response', {
      issueCount: result.error.issues.length,
    });
    throw new Error('Invalid PR toolbar response');
  }

  logger.debug('Validated toolbar response', {
    correlationId: result.data.correlationId,
    status: result.data.status,
  });
  return result.data;
};

export const parseReviewInboxRequest = (
  input: unknown,
): ReviewInboxRequest => {
  const result = reviewInboxRequestSchema.safeParse(input);
  if (!result.success) {
    logger.warn('Rejected invalid review inbox request', {
      issueCount: result.error.issues.length,
    });
    throw new Error('Invalid review inbox request');
  }

  logger.debug('Validated review inbox request', {
    correlationId: result.data.correlationId,
  });
  return result.data;
};

export const parseReviewInboxResponse = (
  input: unknown,
): ReviewInboxResponse => {
  const result = reviewInboxResponseSchema.safeParse(input);
  if (!result.success) {
    logger.warn('Rejected invalid review inbox response', {
      issueCount: result.error.issues.length,
    });
    throw new Error('Invalid review inbox response');
  }

  logger.debug('Validated review inbox response', {
    correlationId: result.data.correlationId,
    status: result.data.status,
    sectionStatuses:
      result.data.status === 'success'
        ? {
            reviewRequests: result.data.data.reviewRequests.status,
            assigned: result.data.data.assigned.status,
            recentActivity: result.data.data.recentActivity.status,
          }
        : undefined,
  });
  return result.data;
};

export const createCorrelationId = (): string => {
  return crypto.randomUUID();
};

export const isReceiverUnavailableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('Receiving end does not exist') ||
    error.message.includes('Could not establish connection') ||
    error.message.includes('No listener was registered')
  );
};
