import type { ReviewInboxPullRequest } from '@/modules/pull-requests';

const REASON_LABELS: Record<ReviewInboxPullRequest['reasons'][number], string> = {
  assigned: 'Assigned',
  'recent-activity': 'Active',
  'review-requested': 'Review requested',
};

const formatUpdatedAt = (updatedAt: string): string => {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(updatedAt));
};

export const ReviewInboxItem = ({ item }: { item: ReviewInboxPullRequest }) => {
  return (
    <article className="review-inbox-item">
      <div className="review-inbox-item__meta">
        <a
          className="review-inbox-item__repository"
          href={item.repository.url}
          target="_blank"
          rel="noreferrer"
          title={item.repository.fullName}
        >
          {item.repository.fullName}
        </a>
        <span aria-hidden="true">#{item.number}</span>
        {item.isDraft ? (
          <span className="review-inbox-item__draft">Draft</span>
        ) : null}
        <time dateTime={item.updatedAt} title={`Updated ${item.updatedAt}`}>
          {formatUpdatedAt(item.updatedAt)}
        </time>
      </div>

      <a
        className="review-inbox-item__title"
        href={item.url}
        target="_blank"
        rel="noreferrer"
      >
        {item.title}
      </a>

      <div className="review-inbox-item__footer">
        <div className="review-inbox-item__reasons" aria-label="Inbox reasons">
          {item.reasons.map((reason) => (
            <span
              className={`review-inbox-item__reason review-inbox-item__reason--${reason}`}
              key={reason}
            >
              {REASON_LABELS[reason]}
            </span>
          ))}
        </div>
        <span className="review-inbox-item__author">
          {item.authorLogin ? `by ${item.authorLogin}` : 'Unknown author'}
        </span>
      </div>
    </article>
  );
};
