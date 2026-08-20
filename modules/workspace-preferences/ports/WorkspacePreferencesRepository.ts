import type {
  GlobalWorkspacePreferences,
  RepositoryWorkspacePreferences,
  SavedInboxFilter,
} from '../domain/WorkspacePreferences'

export interface WorkspacePreferencesRepository {
  listSavedFilters(): Promise<SavedInboxFilter[]>
  upsertSavedFilter(filter: SavedInboxFilter): Promise<SavedInboxFilter[]>
  deleteSavedFilter(filterId: string): Promise<SavedInboxFilter[]>
  getGlobalPreferences(): Promise<GlobalWorkspacePreferences>
  saveGlobalPreferences(
    preferences: GlobalWorkspacePreferences,
  ): Promise<GlobalWorkspacePreferences>
  listRepositoryPreferences(): Promise<RepositoryWorkspacePreferences[]>
  getRepositoryPreferences(
    repositoryKey: string,
  ): Promise<RepositoryWorkspacePreferences | null>
  upsertRepositoryPreferences(
    preferences: RepositoryWorkspacePreferences,
  ): Promise<RepositoryWorkspacePreferences[]>
  deleteRepositoryPreferences(
    repositoryKey: string,
  ): Promise<RepositoryWorkspacePreferences[]>
}
