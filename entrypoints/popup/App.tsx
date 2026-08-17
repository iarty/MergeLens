import { ReviewInbox } from '@/features/review-inbox/ReviewInbox';
import { useReviewInboxQuery } from '@/features/review-inbox/useReviewInboxQuery';
import { useWorkspacePreferences } from '@/features/review-inbox/useWorkspacePreferences';
import { createLogger } from '@/shared/logging/logger';
import { sendMessage } from '@/shared/messaging/protocol';
import './App.css';

const logger = createLogger('popup.app');

const App = () => {
  const inboxQuery = useReviewInboxQuery();
  const workspacePreferences = useWorkspacePreferences();

  const handleRefresh = () => {
    logger.info('Refreshing review inbox from popup');
    void inboxQuery.refetch();
  };

  const handleOpenSettings = () => {
    logger.info('Opening settings from review inbox');
    void sendMessage('openOptionsPage').catch((error: unknown) => {
      logger.error('Failed to open settings from review inbox', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    });
  };

  const handleOpenCommandPalette = () => {
    logger.info('[FIX:command-palette-popup] Opening command palette from popup');
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([activeTab]) => {
        if (activeTab?.id === undefined) {
          throw new Error('Active tab is unavailable');
        }

        await sendMessage('openCommandPalette', undefined, activeTab.id);
        window.close();
      })
      .catch((error: unknown) => {
        logger.warn('[FIX:command-palette-popup] Command palette is unavailable in active tab', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      });
  };

  return (
    <ReviewInbox
      data={inboxQuery.data}
      error={inboxQuery.error ?? undefined}
      isLoading={inboxQuery.isPending}
      isRefreshing={inboxQuery.isRefetching}
      onRefresh={handleRefresh}
      onOpenSettings={handleOpenSettings}
      onOpenCommandPalette={handleOpenCommandPalette}
      savedFilters={workspacePreferences.savedFilters}
      savedFiltersEnabled={workspacePreferences.savedFiltersEnabled}
      activeFilterId={workspacePreferences.activeFilterId}
      isFiltersLoading={workspacePreferences.isLoading}
      hasFiltersLoadError={workspacePreferences.hasLoadError}
      onFilterChange={workspacePreferences.selectFilter}
    />
  );
};

export default App;
