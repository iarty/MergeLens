import type {
  Command,
  CommandContext,
  CommandExecutionResult,
  CommandId,
} from '../types';
import { hasPullRequestContext, hasRepositoryContext } from './context';

const createGitHubUrl = (
  context: CommandContext,
  pathname: string,
): string => {
  const url = new URL(pathname, 'https://github.com');
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new Error('Command navigation URL must target GitHub over HTTPS');
  }

  return url.toString();
};

const success = (commandId: CommandId): CommandExecutionResult => ({
  status: 'success',
  commandId,
});

export const navigationCommands: readonly Command[] = [
  {
    id: 'open-current-pull-request',
    title: 'Open current pull request',
    keywords: ['pr', 'pull request', 'conversation'],
    isAvailable: hasPullRequestContext,
    execute: async (context, dependencies) => {
      if (!context.pageContext) {
        throw new Error('Pull request context is unavailable');
      }

      dependencies.navigate(
        createGitHubUrl(
          context,
          `/${context.pageContext.owner}/${context.pageContext.repository}/pull/${context.pageContext.pullNumber}`,
        ),
      );
      return success('open-current-pull-request');
    },
  },
  {
    id: 'open-repository',
    title: 'Open repository',
    keywords: ['repo', 'code', 'home'],
    isAvailable: hasRepositoryContext,
    execute: async (context, dependencies) => {
      if (!context.repositoryContext) {
        throw new Error('Repository context is unavailable');
      }

      dependencies.navigate(
        createGitHubUrl(
          context,
          `/${context.repositoryContext.owner}/${context.repositoryContext.repository}`,
        ),
      );
      return success('open-repository');
    },
  },
  {
    id: 'open-actions',
    title: 'Open Actions and checks',
    keywords: ['actions', 'checks', 'ci', 'workflow'],
    isAvailable: hasRepositoryContext,
    execute: async (context, dependencies) => {
      if (!context.repositoryContext) {
        throw new Error('Repository context is unavailable');
      }

      dependencies.navigate(
        createGitHubUrl(
          context,
          `/${context.repositoryContext.owner}/${context.repositoryContext.repository}/actions`,
        ),
      );
      return success('open-actions');
    },
  },
];
