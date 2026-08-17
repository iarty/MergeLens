import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const onOpenCommandPalette = vi.fn();
  const renderResult = render(
    <ReviewInbox
      data={createReviewInboxData()}
      isLoading={false}
      isRefreshing={false}
      onRefresh={onRefresh}
      onOpenSettings={onOpenSettings}
      onOpenCommandPalette={onOpenCommandPalette}
      savedFilters={[]}
      activeFilterId={null}
      isFiltersLoading={false}
      hasFiltersLoadError={false}
      onFilterChange={vi.fn()}
      {...props}
    />,
  );
  return { ...renderResult, onRefresh, onOpenSettings, onOpenCommandPalette };
};

describe('ReviewInbox', () => {
  it('exposes the command palette from the extension popup', () => {
    const { onOpenCommandPalette } = renderInbox();

    fireEvent.click(screen.getByRole('button', { name: 'Open command palette' }));

    expect(onOpenCommandPalette).toHaveBeenCalledOnce();
    expect(screen.getByText('Command palette')).toBeVisible();
  });

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

  it('selects a saved filter, switches view, and recomputes visible counts', () => {
    const matchingItem = createReviewInboxItem();
    const hiddenItem = createReviewInboxItem({
      id: '303',
      number: 303,
      title: 'Improve the Next.js router',
      repository: {
        owner: 'vercel',
        name: 'next.js',
        fullName: 'vercel/next.js',
        url: 'https://github.com/vercel/next.js',
      },
    });
    const data = createReviewInboxData(matchingItem);
    data.assigned = { status: 'success', items: [matchingItem, hiddenItem] };
    const savedFilter = {
      id: 'react-assigned',
      name: 'React assigned',
      view: 'assigned' as const,
      criteria: {
        repositories: ['facebook/react'],
        authors: [],
        draftState: 'any' as const,
      },
    };
    const onFilterChange = vi.fn();
    const { rerender } = render(
      <ReviewInbox
        data={data}
        isLoading={false}
        isRefreshing={false}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        savedFilters={[savedFilter]}
        activeFilterId={null}
        isFiltersLoading={false}
        hasFiltersLoadError={false}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Saved filter'), {
      target: { value: 'react-assigned' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('react-assigned');

    rerender(
      <ReviewInbox
        data={data}
        isLoading={false}
        isRefreshing={false}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        savedFilters={[savedFilter]}
        activeFilterId="react-assigned"
        isFiltersLoading={false}
        hasFiltersLoadError={false}
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getByRole('button', { name: /Assigned1/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: 'Improve concurrent rendering behavior' }),
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Improve the Next.js router' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Saved filter'), {
      target: { value: '' },
    });
    expect(onFilterChange).toHaveBeenLastCalledWith(null);
  });

  it('renders a filtered empty state without masking section errors', () => {
    const savedFilter = {
      id: 'draft-review',
      name: 'Draft reviews',
      view: 'reviewRequests' as const,
      criteria: { repositories: [], authors: [], draftState: 'draft' as const },
    };
    const data = createReviewInboxData(
      createReviewInboxItem({ isDraft: false }),
    );
    const { rerender } = renderInbox({
      data,
      savedFilters: [savedFilter],
      activeFilterId: 'draft-review',
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'No pull requests match this filter.',
    );

    data.reviewRequests = {
      status: 'error',
      error: { code: 'rate-limited', message: 'Try later' },
    };
    rerender(
      <ReviewInbox
        data={data}
        isLoading={false}
        isRefreshing={false}
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        savedFilters={[savedFilter]}
        activeFilterId="draft-review"
        isFiltersLoading={false}
        hasFiltersLoadError={false}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Search limit reached');
  });

  it('shows an unfiltered inbox when saved filters are unavailable', () => {
    renderInbox({ hasFiltersLoadError: true });

    expect(screen.getByRole('status')).toHaveTextContent('Filters unavailable');
    expect(screen.getByLabelText('Saved filter')).toBeDisabled();
    expect(
      screen.getByRole('link', { name: 'Improve concurrent rendering behavior' }),
    ).toBeVisible();
  });

  it('resets an active filter that is no longer available', async () => {
    const onFilterChange = vi.fn();
    renderInbox({
      activeFilterId: 'deleted-filter',
      savedFilters: [],
      onFilterChange,
    });

    await waitFor(() => expect(onFilterChange).toHaveBeenCalledWith(null));
  });
});
