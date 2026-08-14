import type { PageContext } from '@/shared/github/context/PageContext';

export type CommandId =
  | 'open-current-pull-request'
  | 'open-repository'
  | 'open-actions'
  | 'open-local-review-workspace'
  | 'open-settings'
  | 'refresh-pull-request-toolbar';

export interface RepositoryContext {
  owner: string;
  repository: string;
}
export interface CommandContext {
  href: string;
  pageContext: PageContext | null;
  repositoryContext: RepositoryContext | null;
}

export interface CommandShortcut {
  key: string;
  modifiers: readonly ('alt' | 'control' | 'meta' | 'shift')[];
}

export interface CommandExecutionResult {
  status: 'success';
  commandId: CommandId;
}

export interface CommandDependencies {
  navigate: (url: string) => void;
  openSettings: () => Promise<void>;
  openLocalReviewWorkspace: () => Promise<void>;
  refreshPullRequestToolbar: () => Promise<void>;
}

export interface Command {
  id: CommandId;
  title: string;
  keywords: readonly string[];
  shortcut?: CommandShortcut;
  isAvailable: (context: CommandContext) => boolean;
  execute: (
    context: CommandContext,
    dependencies: CommandDependencies,
  ) => Promise<CommandExecutionResult>;
}

export interface CommandPaletteState {
  isOpen: boolean;
  selectedIndex: number;
}
