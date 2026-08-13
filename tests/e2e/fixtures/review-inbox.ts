export const createSearchItem = (
  number: number,
  title: string,
  updatedAt = '2026-08-13T02:00:00Z',
) => ({
  id: number,
  number,
  title,
  html_url: `https://github.com/facebook/react/pull/${number}`,
  repository_url: 'https://api.github.com/repos/facebook/react',
  user: { login: 'react-contributor' },
  draft: false,
  updated_at: updatedAt,
  pull_request: {
    url: `https://api.github.com/repos/facebook/react/pulls/${number}`,
  },
});

export const searchResponse = (items: unknown[]) => ({
  total_count: items.length,
  incomplete_results: false,
  items,
});

export const reviewRequestedItem = createSearchItem(
  101,
  'Improve concurrent rendering behavior',
);

export const assignedItems = [
  reviewRequestedItem,
  createSearchItem(202, 'Clarify React server component warnings'),
];

export const recentItems = [
  reviewRequestedItem,
  createSearchItem(303, 'Refine developer tooling metadata'),
];
