import type {
  LocalReviewResult,
  LocalReviewWorkspace,
  PullRequestIdentity,
  PullRequestNote,
  ReviewTemplate,
  ReviewTemplateDraft,
} from '../domain/LocalReview'

export interface CorrelatedLocalReviewRequest {
  correlationId: string
}

export interface GetLocalReviewWorkspaceRequest extends CorrelatedLocalReviewRequest {
  context: PullRequestIdentity
}

export interface SavePullRequestNoteRequest extends CorrelatedLocalReviewRequest {
  context: PullRequestIdentity
  body: string
}

export interface ListReviewTemplatesRequest extends CorrelatedLocalReviewRequest {}

export interface UpsertReviewTemplateRequest extends CorrelatedLocalReviewRequest {
  template: ReviewTemplateDraft
}

export interface DeleteReviewTemplateRequest extends CorrelatedLocalReviewRequest {
  templateId: string
}

export type GetLocalReviewWorkspaceResult =
  LocalReviewResult<LocalReviewWorkspace>
export type SavePullRequestNoteResult = LocalReviewResult<{
  note: PullRequestNote | null
}>
export type ListReviewTemplatesResult = LocalReviewResult<{
  templates: ReviewTemplate[]
}>
export type UpsertReviewTemplateResult = LocalReviewResult<{
  template: ReviewTemplate
  templates: ReviewTemplate[]
}>
export type DeleteReviewTemplateResult = LocalReviewResult<{
  templates: ReviewTemplate[]
}>

export interface LocalReviewUseCaseDependencies {
  now?: () => Date
  createId?: () => string
}
