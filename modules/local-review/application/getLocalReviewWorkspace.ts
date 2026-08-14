import { createLogger } from '@/shared/logging/logger';
import {
  createPullRequestKey,
  sortReviewTemplates,
} from '../domain/LocalReview';
import type { LocalReviewRepository } from '../ports/LocalReviewRepository';
import type {
  GetLocalReviewWorkspaceRequest,
  GetLocalReviewWorkspaceResult,
} from './contracts';
import {
  getErrorName,
  resolveCorrelationId,
  toLocalReviewError,
} from './operation';

const logger = createLogger('localReview.getWorkspace');

export const createGetLocalReviewWorkspace = (
  repository: LocalReviewRepository,
) => {
  return async (
    request: GetLocalReviewWorkspaceRequest,
  ): Promise<GetLocalReviewWorkspaceResult> => {
    const correlationId = resolveCorrelationId(request.correlationId);
    logger.info('Handling local review workspace request', { correlationId });

    try {
      const identity = createPullRequestKey(request.context);
      logger.debug('Loading local review workspace', {
        correlationId,
        prKey: identity.prKey,
      });
      const [note, templates] = await Promise.all([
        repository.readNote(identity),
        repository.listTemplates(),
      ]);
      const sortedTemplates = sortReviewTemplates(templates);
      logger.info('Local review workspace request completed', {
        correlationId,
        prKey: identity.prKey,
        hasNote: Boolean(note),
        templateCount: sortedTemplates.length,
      });
      return {
        status: 'success',
        correlationId,
        data: { note, templates: sortedTemplates },
      };
    } catch (error) {
      const localReviewError = toLocalReviewError(error);
      const log = localReviewError.code === 'storage-unavailable'
        ? logger.error
        : logger.warn;
      log('Local review workspace request failed', {
        correlationId,
        code: localReviewError.code,
        errorName: getErrorName(error),
      });
      return { status: 'error', correlationId, error: localReviewError };
    }
  };
};
