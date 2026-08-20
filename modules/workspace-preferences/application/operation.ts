import {
  MAX_SAVED_FILTER_COUNT,
  WorkspacePreferencesRepositoryError,
  WorkspacePreferencesValidationError,
  normalizeSavedInboxFilterDraft,
  normalizeSavedInboxFilters,
  type SavedInboxFilter,
  type SavedInboxFilterDraft,
} from '../domain/WorkspacePreferences'
import type { WorkspacePreferencesError } from './contracts'

export const upsertSavedInboxFilter = (
  filters: readonly SavedInboxFilter[],
  input: SavedInboxFilterDraft,
  createId: () => string,
): SavedInboxFilter[] => {
  const current = normalizeSavedInboxFilters(filters)
  const draft = normalizeSavedInboxFilterDraft(input)
  const id = draft.id ?? createId().trim()
  if (id.length === 0) {
    throw new WorkspacePreferencesValidationError(
      'Generated filter ID cannot be empty',
      'id',
    )
  }

  const existingIndex = current.findIndex((filter) => filter.id === id)
  if (existingIndex === -1 && current.length >= MAX_SAVED_FILTER_COUNT) {
    throw new WorkspacePreferencesValidationError(
      `No more than ${MAX_SAVED_FILTER_COUNT} saved filters are allowed`,
      'filters',
    )
  }

  return normalizeSavedInboxFilters([
    ...current.filter((filter) => filter.id !== id),
    { ...draft, id },
  ])
}

export const deleteSavedInboxFilter = (
  filters: readonly SavedInboxFilter[],
  filterId: string,
): SavedInboxFilter[] => {
  const normalizedId = filterId.trim()
  if (normalizedId.length === 0) {
    throw new WorkspacePreferencesValidationError(
      'Filter ID cannot be empty',
      'filterId',
    )
  }

  return normalizeSavedInboxFilters(
    filters.filter((filter) => filter.id !== normalizedId),
  )
}

export const toWorkspacePreferencesError = (
  error: unknown,
): WorkspacePreferencesError => {
  if (error instanceof WorkspacePreferencesValidationError) {
    return {
      code: error.code,
      message: error.message,
      issueCount: error.issueCount,
    }
  }
  if (error instanceof WorkspacePreferencesRepositoryError) {
    return { code: error.code, message: error.message }
  }

  return {
    code: 'storage-unavailable',
    message: 'Workspace preferences are unavailable',
  }
}

export const getWorkspacePreferencesErrorName = (error: unknown): string => {
  return error instanceof Error ? error.name : 'UnknownError'
}

export const isExpectedWorkspacePreferencesError = (
  error: unknown,
): boolean => {
  return (
    error instanceof WorkspacePreferencesValidationError ||
    error instanceof WorkspacePreferencesRepositoryError
  )
}
