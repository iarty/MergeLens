import {
  WxtWorkspacePreferencesRepository,
  subscribeWorkspacePreferencesStorage,
} from './adapters/WorkspacePreferencesStorage'
import { createDeleteSavedFilter } from './application/deleteSavedFilter'
import { createGetWorkspacePreferences } from './application/getWorkspacePreferences'
import { createListSavedFilters } from './application/listSavedFilters'
import { createUpdateWorkspacePreferences } from './application/updateWorkspacePreferences'
import { createUpsertSavedFilter } from './application/upsertSavedFilter'
import { createGetEffectiveWorkspacePreferences } from './application/getEffectiveWorkspacePreferences'

export {
  DEFAULT_WORKSPACE_PREFERENCES,
  MAX_SAVED_FILTER_COUNT,
  MAX_SAVED_FILTER_CRITERION_COUNT,
  MAX_SAVED_FILTER_NAME_LENGTH,
  MAX_REPOSITORY_PREFERENCE_COUNT,
  MAX_ESTIMATION_PATTERN_COUNT,
  MAX_ESTIMATION_PATTERN_LENGTH,
  WorkspacePreferencesRepositoryError,
  WorkspacePreferencesValidationError,
  createRepositoryKey,
  matchesSavedInboxFilter,
  normalizeGlobalWorkspacePreferences,
  normalizeRepositoryKey,
  normalizeRepositoryWorkspacePreferences,
  normalizeSavedInboxFilterDraft,
  normalizeSavedInboxFilters,
  resolveEffectiveWorkspacePreferences,
} from './domain/WorkspacePreferences'
export type { WorkspacePreferencesRepository } from './ports/WorkspacePreferencesRepository'
export {
  MAX_WORKSPACE_PREFERENCES_SYNC_ITEM_BYTES,
  WORKSPACE_PREFERENCES_STORAGE_VERSION,
  WxtWorkspacePreferencesRepository,
  subscribeWorkspacePreferencesStorage,
} from './adapters/WorkspacePreferencesStorage'
export type { WorkspacePreferencesStorageChangeCategory } from './adapters/WorkspacePreferencesStorage'
export type {
  CommandPaletteShortcutId,
  DraftStateFilter,
  EffectiveWorkspacePreferences,
  GlobalWorkspacePreferences,
  RepositoryIdentity,
  RepositoryWorkspacePreferences,
  ReviewInboxView,
  SavedInboxFilter,
  SavedInboxFilterCriteria,
  SavedInboxFilterDraft,
  WorkspaceFeatureFlags,
  WorkspacePreferenceOverrides,
  PullRequestEstimationPreferenceOverrides,
  WorkspacePreferencesErrorCode,
} from './domain/WorkspacePreferences'
export {
  deleteSavedInboxFilter,
  getWorkspacePreferencesErrorName,
  isExpectedWorkspacePreferencesError,
  toWorkspacePreferencesError,
  upsertSavedInboxFilter,
} from './application/operation'
export type {
  DeleteSavedInboxFilterInput,
  UpdateWorkspacePreferencesInput,
  UpsertSavedInboxFilterInput,
  WorkspacePreferenceOverridesState,
  WorkspacePreferencesError,
  WorkspacePreferencesResult,
  WorkspacePreferencesState,
  WorkspacePreferencesUseCaseDependencies,
} from './application/contracts'
export type { EffectiveWorkspacePreferencesSnapshot } from './application/getEffectiveWorkspacePreferences'

export { createListSavedFilters } from './application/listSavedFilters'
export { createUpsertSavedFilter } from './application/upsertSavedFilter'
export { createDeleteSavedFilter } from './application/deleteSavedFilter'
export { createGetWorkspacePreferences } from './application/getWorkspacePreferences'
export { createUpdateWorkspacePreferences } from './application/updateWorkspacePreferences'
export { createGetEffectiveWorkspacePreferences } from './application/getEffectiveWorkspacePreferences'

const workspacePreferencesRepository = new WxtWorkspacePreferencesRepository()

export const listSavedFilters = createListSavedFilters(
  workspacePreferencesRepository,
)
export const upsertSavedFilter = createUpsertSavedFilter(
  workspacePreferencesRepository,
)
export const deleteSavedFilter = createDeleteSavedFilter(
  workspacePreferencesRepository,
)
export const getWorkspacePreferences = createGetWorkspacePreferences(
  workspacePreferencesRepository,
)
export const updateWorkspacePreferences = createUpdateWorkspacePreferences(
  workspacePreferencesRepository,
)
export const getEffectiveWorkspacePreferences =
  createGetEffectiveWorkspacePreferences(workspacePreferencesRepository)

export const subscribeWorkspacePreferences =
  subscribeWorkspacePreferencesStorage
