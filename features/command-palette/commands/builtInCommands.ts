import type { Command } from '../types';
import { hasPullRequestContext } from './context';
import { navigationCommands } from './navigationCommands';

export const builtInCommands: readonly Command[] = [
  ...navigationCommands,
  {
    id: 'open-local-review-workspace',
    title: 'Open local review workspace',
    keywords: ['notes', 'private', 'templates', 'review'],
    isAvailable: hasPullRequestContext,
    execute: async (_context, dependencies) => {
      await dependencies.openLocalReviewWorkspace();
      return { status: 'success', commandId: 'open-local-review-workspace' };
    },
  },
  {
    id: 'open-settings',
    title: 'Open MergeLens settings',
    keywords: ['options', 'configuration', 'token'],
    isAvailable: () => true,
    execute: async (_context, dependencies) => {
      await dependencies.openSettings();
      return { status: 'success', commandId: 'open-settings' };
    },
  },
  {
    id: 'refresh-pull-request-toolbar',
    title: 'Refresh pull request toolbar',
    keywords: ['reload', 'update', 'checks', 'status'],
    isAvailable: hasPullRequestContext,
    execute: async (_context, dependencies) => {
      await dependencies.refreshPullRequestToolbar();
      return { status: 'success', commandId: 'refresh-pull-request-toolbar' };
    },
  },
];
