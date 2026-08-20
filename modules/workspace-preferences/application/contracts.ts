import type {
  GlobalWorkspacePreferences,
  RepositoryWorkspacePreferences,
  SavedInboxFilter,
  SavedInboxFilterDraft,
  WorkspacePreferencesErrorCode,
} from '../domain/WorkspacePreferences'

export interface WorkspacePreferencesState {
  savedFilters: SavedInboxFilter[]
  globalPreferences: GlobalWorkspacePreferences
  repositoryPreferences: RepositoryWorkspacePreferences[]
}

export interface UpsertSavedInboxFilterInput {
  filter: SavedInboxFilterDraft
}

export interface DeleteSavedInboxFilterInput {
  filterId: string
}

export type UpdateWorkspacePreferencesInput =
  | {
      kind: 'global'
      preferences: GlobalWorkspacePreferences
    }
  | {
      kind: 'repository-upsert'
      preferences: RepositoryWorkspacePreferences
    }
  | {
      kind: 'repository-delete'
      repositoryKey: string
    }

export interface WorkspacePreferenceOverridesState {
  globalPreferences: GlobalWorkspacePreferences
  repositoryPreferences: RepositoryWorkspacePreferences[]
}

export interface WorkspacePreferencesError {
  code: WorkspacePreferencesErrorCode
  message: string
  issueCount?: number
}

export type WorkspacePreferencesResult<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: WorkspacePreferencesError }

export interface WorkspacePreferencesUseCaseDependencies {
  createId?: () => string
}
