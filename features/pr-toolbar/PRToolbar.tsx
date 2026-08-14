import { useEffect } from 'react';
import type { CheckStatus } from '@/modules/pull-requests';
import { createLogger } from '@/shared/logging/logger';
import type {
  PRToolbarError,
  PRToolbarProps,
} from './types';
import './PRToolbar.css';

const logger = createLogger('prToolbar.ui');

const CHECK_STATUS_LABELS: Record<CheckStatus, string> = {
  'action-required': 'Action required',
  cancelled: 'Cancelled',
  failure: 'Failed',
  'in-progress': 'In progress',
  neutral: 'Neutral',
  queued: 'Queued',
  skipped: 'Skipped',
  success: 'Passed',
  'timed-out': 'Timed out',
  unknown: 'Unknown',
};

const RETRYABLE_ERROR_CODES = new Set<PRToolbarError['code']>([
  'network-error',
  'rate-limited',
  'receiver-unavailable',
  'unknown-error',
]);

const getErrorTitle = (error: PRToolbarError): string => {
  const titles: Partial<Record<PRToolbarError['code'], string>> = {
    'invalid-request': 'Page context changed',
    'invalid-response': 'GitHub returned unexpected data',
    'network-error': 'GitHub is unreachable',
    'rate-limited': 'GitHub rate limit reached',
    'receiver-unavailable': 'MergeLens is reconnecting',
    unauthorized: 'GitHub token needs attention',
    'unknown-error': 'PR data is unavailable',
  };

  return titles[error.code] ?? 'PR data is unavailable';
};

const LoadingState = () => {
  return (
    <div className="pr-toolbar__message" role="status" aria-live="polite">
      <span className="pr-toolbar__spinner" aria-hidden="true" />
      <span>
        <strong>Loading pull request</strong>
        <span>Fetching status and checks from GitHub</span>
      </span>
    </div>
  );
};

const UnsupportedState = () => {
  return (
    <div className="pr-toolbar__message" role="status">
      <span className="pr-toolbar__status-dot pr-toolbar__status-dot--muted" />
      <span>
        <strong>Pull request context unavailable</strong>
        <span>MergeLens will activate on a supported GitHub PR page</span>
      </span>
    </div>
  );
};

const MissingTokenState = ({ onOpenSettings }: Pick<PRToolbarProps, 'onOpenSettings'>) => {
  return (
    <div className="pr-toolbar__message pr-toolbar__message--warning" role="status">
      <span className="pr-toolbar__status-dot pr-toolbar__status-dot--warning" />
      <span>
        <strong>GitHub token required</strong>
        <span>Configure local access to load private PR data and checks</span>
      </span>
      {onOpenSettings ? (
        <button className="pr-toolbar__button" type="button" onClick={onOpenSettings}>
          Open settings
        </button>
      ) : null}
    </div>
  );
};

const ErrorState = ({
  error,
  onRetry,
}: {
  error: PRToolbarError;
  onRetry?: () => void;
}) => {
  const canRetry = RETRYABLE_ERROR_CODES.has(error.code) && onRetry;
  const retryMessage =
    error.code === 'rate-limited' && error.retryAfterSeconds !== undefined
      ? `Retry available in about ${error.retryAfterSeconds} seconds`
      : error.message;

  return (
    <div className="pr-toolbar__message pr-toolbar__message--error" role="alert">
      <span className="pr-toolbar__status-dot pr-toolbar__status-dot--error" />
      <span>
        <strong>{getErrorTitle(error)}</strong>
        <span>{retryMessage}</span>
      </span>
      {canRetry ? (
        <button className="pr-toolbar__button" type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
};

const SuccessState = ({
  data,
  quickLinksError,
  quickLinksStatus,
  onRetry,
}: Extract<PRToolbarProps['state'], { status: 'success' }> &
  Pick<PRToolbarProps, 'onRetry'>) => {
  const visibleChecks = data.checks.slice(0, 4);
  const remainingCheckCount = data.checks.length - visibleChecks.length;

  return (
    <div className="pr-toolbar__success">
      <div className="pr-toolbar__pr">
        <span className={`pr-toolbar__pr-state pr-toolbar__pr-state--${data.pullRequest.state}`}>
          {data.pullRequest.state}
        </span>
        <a
          className="pr-toolbar__title"
          href={data.pullRequest.url}
          target="_blank"
          rel="noreferrer"
        >
          {data.pullRequest.title}
        </a>
        {data.pullRequest.isDraft ? <span className="pr-toolbar__draft">Draft</span> : null}
      </div>

      <div className="pr-toolbar__checks" aria-label="Pull request checks">
        {visibleChecks.length === 0 ? (
          <span className="pr-toolbar__empty-checks">No checks reported</span>
        ) : (
          visibleChecks.map((check) => {
            const content = (
              <>
                <span
                  className={`pr-toolbar__check-dot pr-toolbar__check-dot--${check.status}`}
                  aria-hidden="true"
                />
                <span className="pr-toolbar__check-name">{check.name}</span>
                <span className="pr-toolbar__sr-only">
                  {CHECK_STATUS_LABELS[check.status]}
                </span>
              </>
            );

            return check.detailsUrl ? (
              <a
                className="pr-toolbar__check"
                href={check.detailsUrl}
                target="_blank"
                rel="noreferrer"
                key={check.id}
                title={`${check.name}: ${CHECK_STATUS_LABELS[check.status]}`}
              >
                {content}
              </a>
            ) : (
              <span
                className="pr-toolbar__check"
                key={check.id}
                title={`${check.name}: ${CHECK_STATUS_LABELS[check.status]}`}
              >
                {content}
              </span>
            );
          })
        )}
        {remainingCheckCount > 0 ? (
          <span className="pr-toolbar__remaining">+{remainingCheckCount}</span>
        ) : null}
      </div>

      <a
        className="pr-toolbar__actions-link"
        href={data.actionsUrl}
        target="_blank"
        rel="noreferrer"
      >
        Actions
      </a>
      {data.quickLinks ? (
        <div className="pr-toolbar__quick-links" aria-label="Quick links and deployments">
          {data.quickLinks.configuredLinks.map((link) => (
            <a
              className="pr-toolbar__quick-link"
              href={link.url}
              target="_blank"
              rel="noreferrer"
              key={link.id}
            >
              {link.label}
            </a>
          ))}
          {data.quickLinks.deployments.map((deployment) => {
            const content = (
              <>
                <span
                  className={`pr-toolbar__deployment-dot pr-toolbar__deployment-dot--${deployment.state}`}
                  aria-hidden="true"
                />
                <span>{deployment.environment}</span>
                <span className="pr-toolbar__sr-only">{deployment.state}</span>
              </>
            );
            return deployment.url ? (
              <a
                className="pr-toolbar__deployment"
                href={deployment.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${deployment.environment}: ${deployment.state}`}
                key={deployment.id}
              >
                {content}
              </a>
            ) : (
              <span
                className="pr-toolbar__deployment"
                aria-label={`${deployment.environment}: ${deployment.state}`}
                key={deployment.id}
              >
                {content}
              </span>
            );
          })}
          {data.quickLinks.deployments.length === 0 &&
          data.quickLinks.configuredLinks.length === 0 ? (
            <span className="pr-toolbar__quick-links-empty">No quick links configured</span>
          ) : null}
        </div>
      ) : null}
      {quickLinksStatus === 'loading' ? (
        <span className="pr-toolbar__quick-links-status" role="status">
          Loading deployments
        </span>
      ) : null}
      {quickLinksStatus === 'error' ? (
        <div className="pr-toolbar__quick-links-error">
          <span
            className="pr-toolbar__quick-links-status pr-toolbar__quick-links-status--error"
            role="status"
          >
            {quickLinksError?.code === 'rate-limited'
              ? 'Deployments rate limited'
              : 'Deployments unavailable'}
          </span>
          {onRetry ? (
            <button className="pr-toolbar__button" type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export const PRToolbar = ({ state, onOpenSettings, onRetry }: PRToolbarProps) => {
  useEffect(() => {
    const checkCount = state.status === 'success' ? state.data.checks.length : undefined;
    logger.debug('PR toolbar state changed', { status: state.status, checkCount });

    if (state.status === 'error') {
      logger.warn('PR toolbar rendered a recoverable error state', {
        code: state.error.code,
      });
    }
  }, [state]);

  return (
    <section className="pr-toolbar" aria-label="MergeLens pull request toolbar">
      <div className="pr-toolbar__brand" aria-hidden="true">
        ML
      </div>
      <div className="pr-toolbar__content">
        {state.status === 'loading' ? <LoadingState /> : null}
        {state.status === 'unsupported-context' ? <UnsupportedState /> : null}
        {state.status === 'success' ? (
          <SuccessState {...state} onRetry={onRetry} />
        ) : null}
        {state.status === 'error' && state.error.code === 'missing-token' ? (
          <MissingTokenState onOpenSettings={onOpenSettings} />
        ) : null}
        {state.status === 'error' && state.error.code !== 'missing-token' ? (
          <ErrorState error={state.error} onRetry={onRetry} />
        ) : null}
      </div>
    </section>
  );
};
