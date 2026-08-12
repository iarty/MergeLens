import { createLogger } from '@/shared/logging/logger';
import {
  parseToolbarRequest,
  parseToolbarResponse,
} from '@/shared/messaging/protocol';
import type {
  ToolbarRequest,
  ToolbarResponse,
} from '@/shared/messaging/schemas';
import type { PullRequestReader } from '../ports/PullRequestReader';

const logger = createLogger('pullRequests.getToolbarData');

const getSafeCorrelationId = (input: unknown): string => {
  if (typeof input === 'string' && input.length >= 1 && input.length <= 128) {
    return input;
  }

  return 'invalid-request';
};

export const createGetPullRequestToolbarData = (
  pullRequestReader: PullRequestReader,
) => {
  return async (requestInput: ToolbarRequest): Promise<ToolbarResponse> => {
    let request: ToolbarRequest;

    try {
      request = parseToolbarRequest(requestInput);
    } catch (error) {
      logger.warn('Rejected toolbar request at background boundary', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return parseToolbarResponse({
        status: 'error',
        correlationId: getSafeCorrelationId(requestInput?.correlationId),
        error: {
          code: 'invalid-request',
          message: 'Invalid PR toolbar request',
        },
      });
    }

    logger.info('Handling PR toolbar data request');
    logger.debug('Normalized PR toolbar request', {
      correlationId: request.correlationId,
      owner: request.context.owner,
      repository: request.context.repository,
      pullNumber: request.context.pullNumber,
    });

    try {
      const result = await pullRequestReader.read({
        owner: request.context.owner,
        repository: request.context.repository,
        pullNumber: request.context.pullNumber,
      });

      const response =
        result.status === 'success'
          ? {
              status: 'success' as const,
              correlationId: request.correlationId,
              data: result.data,
            }
          : {
              status: 'error' as const,
              correlationId: request.correlationId,
              error: result.error,
            };
      const validatedResponse = parseToolbarResponse(response);

      if (validatedResponse.status === 'success') {
        logger.info('PR toolbar data request completed', {
          checkCount: validatedResponse.data.checks.length,
        });
      } else {
        logger.warn('PR toolbar data request returned an expected error', {
          code: validatedResponse.error.code,
        });
      }

      return validatedResponse;
    } catch (error) {
      logger.error('Unexpected PR toolbar handler failure', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return parseToolbarResponse({
        status: 'error',
        correlationId: request.correlationId,
        error: {
          code: 'unknown-error',
          message: 'Unable to load PR toolbar data',
        },
      });
    }
  };
};
