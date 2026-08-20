import {
  LocalReviewRepositoryError,
  LocalReviewValidationError,
  type LocalReviewError,
} from '../domain/LocalReview'

export const resolveCorrelationId = (correlationId: unknown): string => {
  return typeof correlationId === 'string' &&
    correlationId.length >= 1 &&
    correlationId.length <= 128
    ? correlationId
    : 'invalid-request'
}

export const getRequestCorrelationId = (request: unknown): string => {
  if (typeof request !== 'object' || request === null) {
    return resolveCorrelationId(undefined)
  }

  return resolveCorrelationId(
    (request as { correlationId?: unknown }).correlationId,
  )
}

export const toLocalReviewError = (error: unknown): LocalReviewError => {
  if (error instanceof LocalReviewValidationError) {
    return { code: error.code, message: error.message }
  }
  if (error instanceof LocalReviewRepositoryError) {
    return { code: error.code, message: error.message }
  }

  return {
    code: 'storage-unavailable',
    message: 'Local review data is unavailable',
  }
}

export const getErrorName = (error: unknown): string => {
  return error instanceof Error ? error.name : 'UnknownError'
}
