import { defineExtensionMessaging } from '@webext-core/messaging';
import { createLogger } from '@/shared/logging/logger';
import {
  toolbarRequestSchema,
  toolbarResponseSchema,
  type ToolbarRequest,
  type ToolbarResponse,
} from './schemas';

const logger = createLogger('messaging');

export interface MergeLensProtocolMap {
  getPullRequestToolbarData(data: ToolbarRequest): ToolbarResponse;
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
