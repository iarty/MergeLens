import { z } from 'zod';
import type {
  ReviewInboxPullRequest,
  ReviewInboxReason,
  ReviewInboxSectionKind,
} from '../domain/ReviewInbox';

const searchResultItemSchema = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  title: z.string().min(1),
  html_url: z.url(),
  repository_url: z.url(),
  user: z
    .object({
      login: z.string().min(1),
    })
    .nullable(),
  draft: z.boolean().optional(),
  updated_at: z.iso.datetime({ offset: true }),
  pull_request: z.object({}).passthrough(),
});

const REPOSITORY_API_PATH = /^\/repos\/([^/]+)\/([^/]+)$/;

const getReason = (kind: ReviewInboxSectionKind): ReviewInboxReason => {
  const reasons: Record<ReviewInboxSectionKind, ReviewInboxReason> = {
    'review-requests': 'review-requested',
    assigned: 'assigned',
    'recent-activity': 'recent-activity',
  };

  return reasons[kind];
};

export const mapReviewInboxSearchItem = (
  input: unknown,
  kind: ReviewInboxSectionKind,
): ReviewInboxPullRequest => {
  const item = searchResultItemSchema.parse(input);
  const repositoryUrl = new URL(item.repository_url);
  const repositoryMatch = repositoryUrl.pathname.match(REPOSITORY_API_PATH);

  if (repositoryUrl.origin !== 'https://api.github.com' || !repositoryMatch) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['repository_url'],
        message: 'Unsupported GitHub repository URL',
        input: item.repository_url,
      },
    ]);
  }

  const [, owner, name] = repositoryMatch;
  if (!owner || !name) {
    throw new Error('Repository identity is unavailable');
  }

  return {
    id: String(item.id),
    number: item.number,
    title: item.title,
    url: item.html_url,
    repository: {
      owner,
      name,
      fullName: `${owner}/${name}`,
      url: `https://github.com/${owner}/${name}`,
    },
    authorLogin: item.user?.login ?? null,
    isDraft: item.draft ?? false,
    updatedAt: item.updated_at,
    reasons: [getReason(kind)],
  };
};

export const mapReviewInboxSearchItems = (
  input: readonly unknown[],
  kind: ReviewInboxSectionKind,
): ReviewInboxPullRequest[] => {
  return input.map((item) => mapReviewInboxSearchItem(item, kind));
};
