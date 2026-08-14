import type {
  CanonicalPullRequestIdentity,
  PullRequestNote,
  ReviewTemplate,
} from '../domain/LocalReview';

export interface LocalReviewRepository {
  readNote(
    identity: CanonicalPullRequestIdentity,
  ): Promise<PullRequestNote | null>;
  saveNote(note: PullRequestNote): Promise<PullRequestNote | null>;
  deleteNote(prKey: string): Promise<void>;
  listTemplates(): Promise<ReviewTemplate[]>;
  upsertTemplate(template: ReviewTemplate): Promise<ReviewTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
}
