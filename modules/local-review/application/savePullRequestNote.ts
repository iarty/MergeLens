import { createLogger } from '@/shared/logging/logger';
import {
  createPullRequestKey,
  normalizePullRequestNoteBody,
  type PullRequestNote,
} from '../domain/LocalReview';
import type { LocalReviewRepository } from '../ports/LocalReviewRepository';
import type {
  LocalReviewUseCaseDependencies,
  SavePullRequestNoteRequest,
  SavePullRequestNoteResult,
} from './contracts';
import {
  getErrorName,
  resolveCorrelationId,
  toLocalReviewError,
} from './operation';

const logger = createLogger('localReview.saveNote');

export const createSavePullRequestNote = (
  repository: LocalReviewRepository,
  dependencies: Pick<LocalReviewUseCaseDependencies, 'now'> = {},
) => {
  const now = dependencies.now ?? (() => new Date());

  return async (
    request: SavePullRequestNoteRequest,
  ): Promise<SavePullRequestNoteResult> => {
    const correlationId = resolveCorrelationId(request.correlationId);
    logger.info('Handling pull request note save', { correlationId });

    try {
      const identity = createPullRequestKey(request.context);
      const body = normalizePullRequestNoteBody(request.body);
      const note: PullRequestNote = {
        ...identity,
        body,
        updatedAt: now().toISOString(),
      };
      logger.debug('Persisting pull request note', {
        correlationId,
        prKey: identity.prKey,
        bodyLength: body.length,
        isDelete: body.length === 0,
      });
      const savedNote = await repository.saveNote(note);
      logger.info('Pull request note save completed', {
        correlationId,
        prKey: identity.prKey,
        isPresent: Boolean(savedNote),
      });
      return {
        status: 'success',
        correlationId,
        data: { note: savedNote },
      };
    } catch (error) {
      const localReviewError = toLocalReviewError(error);
      const log = localReviewError.code === 'storage-unavailable'
        ? logger.error
        : logger.warn;
      log('Pull request note save failed', {
        correlationId,
        code: localReviewError.code,
        errorName: getErrorName(error),
      });
      return { status: 'error', correlationId, error: localReviewError };
    }
  };
};
