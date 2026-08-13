import { parsePageContext } from '@/shared/github/context/parsePageContext';
import type {
  CommandContext,
  RepositoryContext,
} from '../types';

const GITHUB_HOSTNAME = 'github.com';
const REPOSITORY_SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;
const RESERVED_OWNER_SEGMENTS = new Set([
  'apps',
  'collections',
  'events',
  'explore',
  'features',
  'issues',
  'join',
  'login',
  'marketplace',
  'notifications',
  'organizations',
  'orgs',
  'pricing',
  'pulls',
  'search',
  'settings',
  'sponsors',
  'topics',
  'users',
]);

const parseRepositoryContext = (url: URL): RepositoryContext | null => {
  const [owner, repository] = url.pathname.split('/').filter(Boolean);

  if (
    !owner ||
    !repository ||
    RESERVED_OWNER_SEGMENTS.has(owner.toLowerCase()) ||
    !REPOSITORY_SEGMENT_PATTERN.test(owner) ||
    !REPOSITORY_SEGMENT_PATTERN.test(repository)
  ) {
    return null;
  }

  return { owner, repository };
};
export const createCommandContext = (input: string | URL): CommandContext | null => {
  let url: URL;

  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.hostname !== GITHUB_HOSTNAME) {
    return null;
  }

  return {
    href: url.toString(),
    pageContext: parsePageContext(url),
    repositoryContext: parseRepositoryContext(url),
  };
};

export const hasPullRequestContext = (context: CommandContext): boolean => {
  return context.pageContext?.kind === 'pull-request';
};

export const hasRepositoryContext = (context: CommandContext): boolean => {
  return context.repositoryContext !== null;
};
