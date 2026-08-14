import {
  LocalReviewRepositoryError,
  LocalReviewValidationError,
  type LocalReviewError,
} from '../domain/LocalReview';

export const resolveCorrelationId = (correlationId: string): string => {
  return correlationId.trim().length > 0
    ? correlationId
    : 'invalid-correlation-id';
};

export const toLocalReviewError = (error: unknown): LocalReviewError => {
  if (error instanceof LocalReviewValidationError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof LocalReviewRepositoryError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: 'storage-unavailable',
    message: 'Local review data is unavailable',
  };
};

export const getErrorName = (error: unknown): string => {
  return error instanceof Error ? error.name : 'UnknownError';
};
