import { useQuery, type QueryObserverResult } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  listSavedFilters,
  type SavedInboxFilter,
  type WorkspacePreferencesErrorCode,
} from '@/modules/workspace-preferences';
import { createLogger } from '@/shared/logging/logger';

const logger = createLogger('reviewInbox.workspacePreferences');

export const WORKSPACE_PREFERENCES_QUERY_KEY = [
  'workspace-preferences',
  'saved-filters',
] as const;

interface SavedFiltersSnapshot {
  savedFilters: SavedInboxFilter[];
  errorCode?: WorkspacePreferencesErrorCode;
}

export const fetchSavedFilters = async (): Promise<SavedFiltersSnapshot> => {
  logger.debug('Loading saved filters for review inbox');
  try {
    const result = await listSavedFilters();
    if (result.status === 'error') {
      logger.warn('Using unfiltered inbox after saved filter load failure', {
        code: result.error.code,
      });
      return { savedFilters: [], errorCode: result.error.code };
    }

    logger.debug('Loaded saved filters for review inbox', {
      filterCount: result.data.length,
    });
    return { savedFilters: result.data };
  } catch (error) {
    logger.error('Saved filter query failed unexpectedly', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return { savedFilters: [], errorCode: 'storage-unavailable' };
  }
};

export interface WorkspacePreferencesQueryState {
  savedFilters: SavedInboxFilter[];
  activeFilterId: string | null;
  activeFilter: SavedInboxFilter | null;
  isLoading: boolean;
  hasLoadError: boolean;
  selectFilter: (filterId: string | null) => void;
  refetch: () => Promise<QueryObserverResult<SavedFiltersSnapshot, Error>>;
}

export const useWorkspacePreferences = (): WorkspacePreferencesQueryState => {
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const query = useQuery<SavedFiltersSnapshot, Error>({
    queryKey: WORKSPACE_PREFERENCES_QUERY_KEY,
    queryFn: fetchSavedFilters,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const savedFilters = query.data?.savedFilters ?? [];
  const activeFilter =
    savedFilters.find(({ id }) => id === activeFilterId) ?? null;

  useEffect(() => {
    logger.debug('Saved filter query state changed', {
      status: query.status,
      fetchStatus: query.fetchStatus,
      filterCount: savedFilters.length,
      hasLoadError: query.data?.errorCode !== undefined,
      activeFilterId: activeFilterId ?? undefined,
    });
  }, [
    activeFilterId,
    query.data?.errorCode,
    query.fetchStatus,
    query.status,
    savedFilters.length,
  ]);

  useEffect(() => {
    if (!query.isSuccess || activeFilterId === null || activeFilter !== null) {
      return;
    }

    logger.debug('Reset active filter after saved filter removal', {
      filterId: activeFilterId,
      filterCount: savedFilters.length,
    });
    setActiveFilterId(null);
  }, [activeFilter, activeFilterId, query.isSuccess, savedFilters.length]);

  const selectFilter = useCallback((filterId: string | null): void => {
    if (filterId === null) {
      logger.info('Cleared active saved filter', {
        previousFilterId: activeFilterId ?? undefined,
      });
      setActiveFilterId(null);
      return;
    }

    const filter = savedFilters.find(({ id }) => id === filterId);
    if (!filter) {
      logger.warn('Rejected unavailable saved filter selection', { filterId });
      setActiveFilterId(null);
      return;
    }

    logger.info('Selected active saved filter', {
      filterId,
      selectedView: filter.view,
    });
    setActiveFilterId(filterId);
  }, [activeFilterId, savedFilters]);

  return {
    savedFilters,
    activeFilterId,
    activeFilter,
    isLoading: query.isPending,
    hasLoadError: query.data?.errorCode !== undefined,
    selectFilter,
    refetch: query.refetch,
  };
};
