import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewInbox } from '@/features/review-inbox/ReviewInbox';
import {
  createReviewInboxData,
  createReviewInboxItem,
} from '@/tests/helpers/reviewInbox';

const renderInbox = (
  props: Partial<React.ComponentProps<typeof ReviewInbox>> = {},
) => {
  const onRefresh = vi.fn();
  const onOpenSettings = vi.fn();
  render(
    <ReviewInbox
      data={createReviewInboxData()}
      isLoading={false}
      isRefreshing={false}
      onRefresh={onRefresh}
      onOpenSettings={onOpenSettings}
      {...props}
    />,
  );
  return { onRefresh, onOpenSettings };
};

describe('ReviewInbox', () => {
  it('renders loading state and disabled refresh', () => {
    renderInbox({ data: undefined, isLoading: true });

    expect(screen.getByRole('status')).toHaveTextContent('Loading review inbox');
    expect(screen.getByRole('button', { name: 'Refresh inbox' })).toBeDisabled();
  });

  it('renders combined reasons and safe PR/repository links', () => {
    renderInbox();

    expect(screen.getByText('Review requested')).toBeInTheDocument();
    expect(
      document.querySelector('.review-inbox-item__reason--assigned'),
    ).toHaveTextContent('Assigned');
    const pullRequest = screen.getByRole('link', {
      name: 'Improve concurrent rendering behavior',
    });
    const repository = screen.getByRole('link', { name: 'facebook/react' });
    expect(pullRequest).toHaveAttribute(
      'href',
      'https://github.com/facebook/react/pull/101',
    );
    expect(pullRequest).toHaveAttribute('rel', 'noreferrer');
    expect(repository).toHaveAttribute(
      'href',
      'https://github.com/facebook/react',
    );
  });

  it('switches views and invokes refresh with keyboard-accessible buttons', () => {
    const { onRefresh } = renderInbox();

    fireEvent.click(screen.getByRole('button', { name: /Recent/ }));
    expect(
      screen.getByRole('link', { name: 'Refine React developer warnings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recent/ })).toHaveAttribute(
      'aria-current',
      'page',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh inbox' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('keeps successful sections available when assigned fails', () => {
    const data = createReviewInboxData();
    data.assigned = {
      status: 'error',
      error: { code: 'rate-limited', message: 'Try later' },
    };
    renderInbox({ data });

    expect(
      screen.getByRole('link', { name: 'Improve concurrent rendering behavior' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Assigned/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Search limit reached');
  });

  it('opens settings for missing credentials', () => {
    const { onOpenSettings } = renderInbox({
      data: undefined,
      error: {
        code: 'missing-token',
        message: 'GitHub token is not configured',
      },
    });

    const settingsCommands = screen.getAllByRole('button', {
      name: 'Open settings',
    });
    fireEvent.click(
      settingsCommands.find((button) =>
        button.classList.contains('review-inbox__command'),
      )!,
    );
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('renders empty and long-content states without changing semantics', () => {
    const longTitle = 'A'.repeat(220);
    const longRepository = `facebook/${'repository'.repeat(20)}`;
    const item = createReviewInboxItem({
      title: longTitle,
      repository: {
        owner: 'facebook',
        name: 'repository'.repeat(20),
        fullName: longRepository,
        url: 'https://github.com/facebook/react',
      },
    });
    const data = createReviewInboxData(item);
    data.assigned = { status: 'success', items: [] };
    renderInbox({ data });

    expect(screen.getByRole('link', { name: longTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: longRepository })).toHaveAttribute(
      'title',
      longRepository,
    );
    fireEvent.click(screen.getByRole('button', { name: /Assigned/ }));
    expect(screen.getByRole('status')).toHaveTextContent('All clear');
  });
});
