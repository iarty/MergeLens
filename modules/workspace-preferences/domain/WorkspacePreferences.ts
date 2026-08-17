import type { ReviewInboxPullRequest } from '@/modules/pull-requests';

export const MAX_SAVED_FILTER_COUNT = 25;
export const MAX_SAVED_FILTER_NAME_LENGTH = 80;
export const MAX_SAVED_FILTER_CRITERION_COUNT = 20;
export const MAX_REPOSITORY_PREFERENCE_COUNT = 100;

const MAX_IDENTIFIER_LENGTH = 128;
const MAX_REPOSITORY_SEGMENT_LENGTH = 100;
const MAX_GITHUB_LOGIN_LENGTH = 39;

export type ReviewInboxView =
  | 'reviewRequests'
  | 'assigned'
  | 'recentActivity';

export type DraftStateFilter = 'any' | 'draft' | 'ready';

export interface SavedInboxFilterCriteria {
  repositories: string[];
  authors: string[];
  draftState: DraftStateFilter;
}

export interface SavedInboxFilter {
  id: string;
  name: string;
  view: ReviewInboxView;
  criteria: SavedInboxFilterCriteria;
}

export interface SavedInboxFilterDraft {
  id?: string;
  name: string;
  view: ReviewInboxView;
  criteria: SavedInboxFilterCriteria;
}

export interface RepositoryIdentity {
  owner: string;
  repository: string;
}

export type CommandPaletteShortcutId =
  | 'primary-k'
  | 'primary-shift-k'
  | 'primary-shift-p';

export interface WorkspaceFeatureFlags {
  savedFilters: boolean;
  customCommandPaletteShortcut: boolean;
}

export interface WorkspacePreferenceOverrides {
  featureFlags?: Partial<WorkspaceFeatureFlags>;
  commandPaletteShortcut?: CommandPaletteShortcutId;
}

export interface GlobalWorkspacePreferences
  extends WorkspacePreferenceOverrides {}

export interface RepositoryWorkspacePreferences
  extends WorkspacePreferenceOverrides {
  repositoryKey: string;
}

export interface EffectiveWorkspacePreferences {
  featureFlags: WorkspaceFeatureFlags;
  commandPaletteShortcut: CommandPaletteShortcutId;
}

export const DEFAULT_WORKSPACE_PREFERENCES: EffectiveWorkspacePreferences = {
  featureFlags: {
    savedFilters: true,
    customCommandPaletteShortcut: true,
  },
  commandPaletteShortcut: 'primary-k',
};

export type WorkspacePreferencesErrorCode =
  | 'invalid-input'
  | 'quota-exceeded'
  | 'storage-unavailable';

export class WorkspacePreferencesValidationError extends Error {
  readonly code = 'invalid-input' as const;
  readonly issueCount: number;

  constructor(
    message: string,
    readonly field: string,
    issueCount = 1,
  ) {
    super(message);
    this.name = 'WorkspacePreferencesValidationError';
    this.issueCount = issueCount;
  }
}

export class WorkspacePreferencesRepositoryError extends Error {
  constructor(
    readonly code: Exclude<WorkspacePreferencesErrorCode, 'invalid-input'>,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WorkspacePreferencesRepositoryError';
  }
}

const requireBoundedString = (
  value: string,
  field: string,
  maxLength: number,
): string => {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new WorkspacePreferencesValidationError(
      `${field} must contain 1-${maxLength} characters`,
      field,
    );
  }

  return normalized;
};

const normalizeRepositorySegment = (value: string, field: string): string => {
  const normalized = requireBoundedString(
    value,
    field,
    MAX_REPOSITORY_SEGMENT_LENGTH,
  ).toLowerCase();
  if (normalized.includes('/')) {
    throw new WorkspacePreferencesValidationError(
      `${field} must identify one GitHub repository segment`,
      field,
    );
  }

  return normalized;
};

export const createRepositoryKey = ({
  owner,
  repository,
}: RepositoryIdentity): string => {
  return `${normalizeRepositorySegment(owner, 'owner')}/${normalizeRepositorySegment(repository, 'repository')}`;
};

export const normalizeRepositoryKey = (repositoryKey: string): string => {
  const segments = repositoryKey.trim().split('/');
  const [owner, repository] = segments;
  if (segments.length !== 2 || owner === undefined || repository === undefined) {
    throw new WorkspacePreferencesValidationError(
      'repositoryKey must use the owner/repository format',
      'repositoryKey',
    );
  }

  return createRepositoryKey({ owner, repository });
};

const normalizeAuthorLogin = (author: string): string => {
  const normalized = author.trim().replace(/^@/, '').toLowerCase();
  const isValid =
    normalized.length > 0 &&
    normalized.length <= MAX_GITHUB_LOGIN_LENGTH &&
    /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(normalized) &&
    !normalized.includes('--');
  if (!isValid) {
    throw new WorkspacePreferencesValidationError(
      'authors must contain valid GitHub logins',
      'authors',
    );
  }

  return normalized;
};

const normalizeCriteriaList = (
  values: readonly string[],
  field: 'repositories' | 'authors',
  normalize: (value: string) => string,
): string[] => {
  if (values.length > MAX_SAVED_FILTER_CRITERION_COUNT) {
    throw new WorkspacePreferencesValidationError(
      `${field} cannot contain more than ${MAX_SAVED_FILTER_CRITERION_COUNT} entries`,
      field,
    );
  }

  return [...new Set(values.map(normalize))].sort((left, right) =>
    left.localeCompare(right),
  );
};

const isReviewInboxView = (value: string): value is ReviewInboxView => {
  return ['reviewRequests', 'assigned', 'recentActivity'].includes(value);
};

const isDraftStateFilter = (value: string): value is DraftStateFilter => {
  return ['any', 'draft', 'ready'].includes(value);
};

const normalizeFilterId = (id: string): string => {
  return requireBoundedString(id, 'id', MAX_IDENTIFIER_LENGTH);
};

export const normalizeSavedInboxFilterDraft = (
  draft: SavedInboxFilterDraft,
): SavedInboxFilterDraft => {
  const id = draft.id === undefined ? undefined : normalizeFilterId(draft.id);
  const name = requireBoundedString(
    draft.name,
    'name',
    MAX_SAVED_FILTER_NAME_LENGTH,
  );
  if (!isReviewInboxView(draft.view)) {
    throw new WorkspacePreferencesValidationError(
      'view must identify a supported review inbox section',
      'view',
    );
  }
  if (!isDraftStateFilter(draft.criteria.draftState)) {
    throw new WorkspacePreferencesValidationError(
      'draftState must be any, draft, or ready',
      'draftState',
    );
  }

  return {
    ...(id === undefined ? {} : { id }),
    name,
    view: draft.view,
    criteria: {
      repositories: normalizeCriteriaList(
        draft.criteria.repositories,
        'repositories',
        normalizeRepositoryKey,
      ),
      authors: normalizeCriteriaList(
        draft.criteria.authors,
        'authors',
        normalizeAuthorLogin,
      ),
      draftState: draft.criteria.draftState,
    },
  };
};

export const normalizeSavedInboxFilters = (
  filters: readonly SavedInboxFilter[],
): SavedInboxFilter[] => {
  if (filters.length > MAX_SAVED_FILTER_COUNT) {
    throw new WorkspacePreferencesValidationError(
      `No more than ${MAX_SAVED_FILTER_COUNT} saved filters are allowed`,
      'filters',
    );
  }

  const normalized = filters.map((filter) => {
    const draft = normalizeSavedInboxFilterDraft(filter);
    return { ...draft, id: normalizeFilterId(filter.id) };
  });
  const uniqueIds = new Set(normalized.map(({ id }) => id));
  const uniqueNames = new Set(
    normalized.map(({ name }) => name.toLocaleLowerCase()),
  );
  if (uniqueIds.size !== normalized.length) {
    throw new WorkspacePreferencesValidationError(
      'Saved filter IDs must be unique',
      'id',
    );
  }
  if (uniqueNames.size !== normalized.length) {
    throw new WorkspacePreferencesValidationError(
      'Saved filter names must be unique',
      'name',
    );
  }

  return normalized.sort(
    (left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
      left.id.localeCompare(right.id),
  );
};

const SUPPORTED_SHORTCUTS = new Set<CommandPaletteShortcutId>([
  'primary-k',
  'primary-shift-k',
  'primary-shift-p',
]);

const normalizeShortcut = (
  shortcut: CommandPaletteShortcutId,
): CommandPaletteShortcutId => {
  if (!SUPPORTED_SHORTCUTS.has(shortcut)) {
    throw new WorkspacePreferencesValidationError(
      'commandPaletteShortcut is not supported',
      'commandPaletteShortcut',
    );
  }
  return shortcut;
};

const normalizeFeatureFlags = (
  featureFlags: Partial<WorkspaceFeatureFlags> | undefined,
): Partial<WorkspaceFeatureFlags> | undefined => {
  if (featureFlags === undefined) return undefined;

  const normalized: Partial<WorkspaceFeatureFlags> = {};
  for (const key of [
    'savedFilters',
    'customCommandPaletteShortcut',
  ] as const) {
    const value = featureFlags[key];
    if (value !== undefined && typeof value !== 'boolean') {
      throw new WorkspacePreferencesValidationError(
        `${key} must be a boolean`,
        key,
      );
    }
    if (value !== undefined) normalized[key] = value;
  }
  return normalized;
};

export const normalizeGlobalWorkspacePreferences = (
  preferences: GlobalWorkspacePreferences,
): GlobalWorkspacePreferences => {
  const featureFlags = normalizeFeatureFlags(preferences.featureFlags);
  return {
    ...(featureFlags === undefined ? {} : { featureFlags }),
    ...(preferences.commandPaletteShortcut === undefined
      ? {}
      : {
          commandPaletteShortcut: normalizeShortcut(
            preferences.commandPaletteShortcut,
          ),
        }),
  };
};

export const normalizeRepositoryWorkspacePreferences = (
  preferences: RepositoryWorkspacePreferences,
): RepositoryWorkspacePreferences => {
  return {
    repositoryKey: normalizeRepositoryKey(preferences.repositoryKey),
    ...normalizeGlobalWorkspacePreferences(preferences),
  };
};

export const resolveEffectiveWorkspacePreferences = (
  globalPreferences: GlobalWorkspacePreferences = {},
  repositoryPreferences?: RepositoryWorkspacePreferences,
): EffectiveWorkspacePreferences => {
  const global = normalizeGlobalWorkspacePreferences(globalPreferences);
  const repository = repositoryPreferences
    ? normalizeRepositoryWorkspacePreferences(repositoryPreferences)
    : undefined;

  return {
    featureFlags: {
      ...DEFAULT_WORKSPACE_PREFERENCES.featureFlags,
      ...global.featureFlags,
      ...repository?.featureFlags,
    },
    commandPaletteShortcut:
      repository?.commandPaletteShortcut ??
      global.commandPaletteShortcut ??
      DEFAULT_WORKSPACE_PREFERENCES.commandPaletteShortcut,
  };
};

export const matchesSavedInboxFilter = (
  pullRequest: ReviewInboxPullRequest,
  filter: SavedInboxFilter,
): boolean => {
  const { repositories, authors, draftState } = filter.criteria;
  if (
    repositories.length > 0 &&
    !repositories.includes(pullRequest.repository.fullName.toLowerCase())
  ) {
    return false;
  }
  if (
    authors.length > 0 &&
    (pullRequest.authorLogin === null ||
      !authors.includes(pullRequest.authorLogin.toLowerCase()))
  ) {
    return false;
  }
  if (draftState === 'draft') return pullRequest.isDraft;
  if (draftState === 'ready') return !pullRequest.isDraft;
  return true;
};
