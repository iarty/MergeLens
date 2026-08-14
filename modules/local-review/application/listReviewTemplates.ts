import { createLogger } from '@/shared/logging/logger';
import { sortReviewTemplates } from '../domain/LocalReview';
import type { LocalReviewRepository } from '../ports/LocalReviewRepository';
import type {
  ListReviewTemplatesRequest,
  ListReviewTemplatesResult,
} from './contracts';
import {
  getErrorName,
  resolveCorrelationId,
  toLocalReviewError,
} from './operation';

const logger = createLogger('localReview.listTemplates');

export const createListReviewTemplates = (
  repository: LocalReviewRepository,
) => {
  return async (
    request: ListReviewTemplatesRequest,
  ): Promise<ListReviewTemplatesResult> => {
    const correlationId = resolveCorrelationId(request.correlationId);
    logger.info('Handling review template list request', { correlationId });

    try {
      const templates = sortReviewTemplates(await repository.listTemplates());
      logger.info('Review template list request completed', {
        correlationId,
        templateCount: templates.length,
      });
      return {
        status: 'success',
        correlationId,
        data: { templates },
      };
    } catch (error) {
      const localReviewError = toLocalReviewError(error);
      const log = localReviewError.code === 'storage-unavailable'
        ? logger.error
        : logger.warn;
      log('Review template list request failed', {
        correlationId,
        code: localReviewError.code,
        errorName: getErrorName(error),
      });
      return { status: 'error', correlationId, error: localReviewError };
    }
  };
};
