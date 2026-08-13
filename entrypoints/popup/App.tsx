import { ReviewInbox } from '@/features/review-inbox/ReviewInbox';
import { useReviewInboxQuery } from '@/features/review-inbox/useReviewInboxQuery';
import { createLogger } from '@/shared/logging/logger';
import { sendMessage } from '@/shared/messaging/protocol';
import './App.css';

const logger = createLogger('popup.app');

const App = () => {
  const inboxQuery = useReviewInboxQuery();

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

  return (
    <ReviewInbox
      data={inboxQuery.data}
      error={inboxQuery.error ?? undefined}
      isLoading={inboxQuery.isPending}
      isRefreshing={inboxQuery.isRefetching}
      onRefresh={handleRefresh}
      onOpenSettings={handleOpenSettings}
    />
  );
};

export default App;
