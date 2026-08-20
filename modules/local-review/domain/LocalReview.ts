export const MAX_PULL_REQUEST_NOTE_LENGTH = 50_000
export const MAX_REVIEW_TEMPLATE_COUNT = 100
export const MAX_REVIEW_TEMPLATE_TITLE_LENGTH = 80
export const MAX_REVIEW_TEMPLATE_BODY_LENGTH = 20_000

const MAX_REPOSITORY_SEGMENT_LENGTH = 100

export interface PullRequestIdentity {
  owner: string
  repository: string
  pullNumber: number
}

export interface CanonicalPullRequestIdentity extends PullRequestIdentity {
  prKey: string
}

export interface PullRequestNote extends CanonicalPullRequestIdentity {
  body: string
  updatedAt: string
}

export interface ReviewTemplate {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

export interface ReviewTemplateDraft {
  id?: string
  title: string
  body: string
}

export interface LocalReviewWorkspace {
  note: PullRequestNote | null
  templates: ReviewTemplate[]
}

export type LocalReviewErrorCode =
  'invalid-input' | 'quota-exceeded' | 'storage-unavailable'

export interface LocalReviewError {
  code: LocalReviewErrorCode
  message: string
}

export type LocalReviewResult<T> =
  | { status: 'success'; correlationId: string; data: T }
  | { status: 'error'; correlationId: string; error: LocalReviewError }

export class LocalReviewValidationError extends Error {
  readonly code = 'invalid-input' as const

  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message)
    this.name = 'LocalReviewValidationError'
  }
}

export class LocalReviewRepositoryError extends Error {
  constructor(
    readonly code: Exclude<LocalReviewErrorCode, 'invalid-input'>,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'LocalReviewRepositoryError'
  }
}

const normalizeRepositorySegment = (value: string, field: string): string => {
  const normalized = value.trim().toLowerCase()
  if (
    normalized.length === 0 ||
    normalized.length > MAX_REPOSITORY_SEGMENT_LENGTH ||
    normalized.includes('/')
  ) {
    throw new LocalReviewValidationError(
      `${field} must identify one GitHub repository segment`,
      field,
    )
  }

  return normalized
}

export const createPullRequestKey = (
  identity: PullRequestIdentity,
): CanonicalPullRequestIdentity => {
  if (!Number.isInteger(identity.pullNumber) || identity.pullNumber <= 0) {
    throw new LocalReviewValidationError(
      'pullNumber must be a positive integer',
      'pullNumber',
    )
  }

  const owner = normalizeRepositorySegment(identity.owner, 'owner')
  const repository = normalizeRepositorySegment(
    identity.repository,
    'repository',
  )

  return {
    owner,
    repository,
    pullNumber: identity.pullNumber,
    prKey: `${owner}/${repository}#${identity.pullNumber}`,
  }
}

export const normalizePullRequestNoteBody = (body: string): string => {
  if (body.length > MAX_PULL_REQUEST_NOTE_LENGTH) {
    throw new LocalReviewValidationError(
      `Note body cannot exceed ${MAX_PULL_REQUEST_NOTE_LENGTH} characters`,
      'body',
    )
  }

  return body.trim().length === 0 ? '' : body
}

export const normalizeReviewTemplateDraft = (
  draft: ReviewTemplateDraft,
): ReviewTemplateDraft => {
  const id = draft.id?.trim()
  const title = draft.title.trim()

  if (id !== undefined && id.length === 0) {
    throw new LocalReviewValidationError('Template ID cannot be empty', 'id')
  }
  if (title.length === 0 || title.length > MAX_REVIEW_TEMPLATE_TITLE_LENGTH) {
    throw new LocalReviewValidationError(
      `Template title must contain 1-${MAX_REVIEW_TEMPLATE_TITLE_LENGTH} characters`,
      'title',
    )
  }
  if (
    draft.body.trim().length === 0 ||
    draft.body.length > MAX_REVIEW_TEMPLATE_BODY_LENGTH
  ) {
    throw new LocalReviewValidationError(
      `Template body must contain 1-${MAX_REVIEW_TEMPLATE_BODY_LENGTH} characters`,
      'body',
    )
  }

  return { id, title, body: draft.body }
}

export const sortReviewTemplates = (
  templates: readonly ReviewTemplate[],
): ReviewTemplate[] => {
  return [...templates].sort(
    (left, right) =>
      left.title.localeCompare(right.title, undefined, {
        sensitivity: 'base',
      }) || left.id.localeCompare(right.id),
  )
}
