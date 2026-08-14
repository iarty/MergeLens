import { createLogger } from '@/shared/logging/logger';
import {
  LocalReviewValidationError,
  sortReviewTemplates,
} from '../domain/LocalReview';
import type { LocalReviewRepository } from '../ports/LocalReviewRepository';
import type {
  DeleteReviewTemplateRequest,
  DeleteReviewTemplateResult,
} from './contracts';
import {
  getErrorName,
  resolveCorrelationId,
  toLocalReviewError,
} from './operation';

const logger = createLogger('localReview.deleteTemplate');

export const createDeleteReviewTemplate = (
  repository: LocalReviewRepository,
) => {
  return async (
    request: DeleteReviewTemplateRequest,
  ): Promise<DeleteReviewTemplateResult> => {
    const correlationId = resolveCorrelationId(request.correlationId);
    logger.info('Handling review template deletion', { correlationId });

    try {
      const templateId = request.templateId.trim();
      if (templateId.length === 0) {
        throw new LocalReviewValidationError(
          'Template ID cannot be empty',
          'templateId',
        );
      }

      logger.debug('Deleting review template through repository', {
        correlationId,
        templateId,
      });
      await repository.deleteTemplate(templateId);
      const templates = sortReviewTemplates(await repository.listTemplates());
      logger.info('Review template deletion completed', {
        correlationId,
        templateId,
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
      log('Review template deletion failed', {
        correlationId,
        code: localReviewError.code,
        errorName: getErrorName(error),
      });
      return { status: 'error', correlationId, error: localReviewError };
    }
  };
};
