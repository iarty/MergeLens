import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PRToolbar } from '@/features/pr-toolbar/PRToolbar';
import type { ToolbarData } from '@/shared/messaging/schemas';

const toolbarData: ToolbarData = {
  pullRequest: {
    title: 'Add resilient PR toolbar',
    url: 'https://github.com/facebook/react/pull/42',
    state: 'open',
    isDraft: false,
    authorLogin: 'octocat',
  },
  checks: [
    {
      id: '1',
      name: 'Unit tests',
      status: 'success',
      detailsUrl: 'https://github.com/facebook/react/actions/runs/1',
    },
    {
      id: '2',
      name: 'Browser tests',
      status: 'in-progress',
      detailsUrl: null,
    },
  ],
  actionsUrl: 'https://github.com/facebook/react/actions',
};

describe('PRToolbar', () => {
  it('renders an accessible loading state', () => {
    render(<PRToolbar state={{ status: 'loading' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading pull request');
  });

  it('renders normalized PR data and safe external links', () => {
    render(<PRToolbar state={{ status: 'success', data: toolbarData }} />);

    const pullRequestLink = screen.getByRole('link', {
      name: 'Add resilient PR toolbar',
    });
    const checkLink = screen.getByRole('link', { name: /Unit tests/ });
    const actionsLink = screen.getByRole('link', { name: 'Actions' });

    expect(pullRequestLink).toHaveAttribute('href', toolbarData.pullRequest.url);
    expect(checkLink).toHaveAttribute('href', toolbarData.checks[0]?.detailsUrl);
    expect(actionsLink).toHaveAttribute('href', toolbarData.actionsUrl);
    expect(pullRequestLink).toHaveAttribute('rel', 'noreferrer');
    expect(screen.getByText('Browser tests').closest('a')).toBeNull();
  });

  it('renders configured links and deployment states with safe links', () => {
    render(
      <PRToolbar
        state={{
          status: 'success',
          quickLinksStatus: 'success',
          data: {
            ...toolbarData,
            quickLinks: {
              configuredLinks: [{ id: 'docs', label: 'Project docs', url: 'https://docs.example.com/' }],
              deployments: [{ id: '7', environment: 'Preview', state: 'success', url: 'https://preview.example.com/', updatedAt: '2026-08-14T01:00:00Z' }],
            },
          },
        }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Project docs' })).toHaveAttribute('rel', 'noreferrer');
    expect(screen.getByRole('link', { name: 'Preview: success' })).toHaveAttribute('href', 'https://preview.example.com/');
  });

  it('preserves toolbar content and offers retry while deployments are unavailable', () => {
    const onRetry = vi.fn();
    render(
      <PRToolbar
        state={{
          status: 'success',
          data: toolbarData,
          quickLinksStatus: 'error',
          quickLinksError: { code: 'rate-limited', message: 'Try later' },
        }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('link', { name: 'Actions' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Deployments rate limited');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the empty checks state without treating the PR as an error', () => {
    render(
      <PRToolbar
        state={{ status: 'success', data: { ...toolbarData, checks: [] } }}
      />,
    );

    expect(screen.getByText('No checks reported')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Actions' })).toBeInTheDocument();
  });

  it('opens settings for a missing token without displaying credentials', () => {
    const onOpenSettings = vi.fn();
    render(
      <PRToolbar
        state={{
          status: 'error',
          error: {
            code: 'missing-token',
            message: 'GitHub token is not configured',
          },
        }}
        onOpenSettings={onOpenSettings}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(screen.queryByText(/github_pat_/i)).not.toBeInTheDocument();
  });

  it('renders retryable API errors and invokes retry', () => {
    const onRetry = vi.fn();
    render(
      <PRToolbar
        state={{
          status: 'error',
          error: {
            code: 'rate-limited',
            message: 'GitHub API rate limit exceeded',
            retryAfterSeconds: 30,
          },
        }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Retry available in about 30 seconds');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders unsupported context without actions', () => {
    render(<PRToolbar state={{ status: 'unsupported-context' }} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Pull request context unavailable',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
