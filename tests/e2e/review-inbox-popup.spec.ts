import {
  expect,
  test,
  type BrowserContext,
  type Route,
} from '@playwright/test';
import {
  closeExtension,
  bootstrapExtensionWorker,
  configureLocalCredential,
  configureWorkspacePreferences,
  getExtensionId,
  launchExtension,
  openExtensionPopup,
} from './extension';
import {
  assignedItems,
  recentItems,
  reviewRequestedItem,
  searchResponse,
} from './fixtures/review-inbox';

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
};

const getSearchKind = (requestUrl: string) => {
  const query = new URL(requestUrl).searchParams.get('q') ?? '';

  if (query.includes('review-requested:@me')) {
    return 'review-requests' as const;
  }
  if (query.includes('assignee:@me')) {
    return 'assigned' as const;
  }
  if (query.includes('involves:@me')) {
    return 'recent-activity' as const;
  }

  return null;
};

const installSuccessfulSearchRoutes = async (context: BrowserContext) => {
  await context.route('https://api.github.com/**', async (route) => {
    const kind = getSearchKind(route.request().url());
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (kind === 'review-requests') {
      await fulfillJson(route, searchResponse([reviewRequestedItem]));
      return;
    }
    if (kind === 'assigned') {
      await fulfillJson(route, searchResponse(assignedItems));
      return;
    }
    if (kind === 'recent-activity') {
      await fulfillJson(route, searchResponse(recentItems));
      return;
    }

    await fulfillJson(route, { message: 'Unexpected inbox fixture request' }, 404);
  });
};

test('loads the review inbox and opens extension settings', async () => {
  const context = await test.step('launch extension', () => launchExtension());
  try {
    await installSuccessfulSearchRoutes(context);
    const serviceWorker = await test.step('bootstrap background worker', () =>
      bootstrapExtensionWorker(context),
    );
    await test.step('configure extension storage', () =>
      configureLocalCredential(serviceWorker),
    );
    const popup = await test.step('open popup page', () =>
      openExtensionPopup(context, serviceWorker),
    );

    await expect(popup.getByRole('status')).toContainText('Loading review inbox');
    const pullRequestLink = popup.getByRole('link', {
      name: 'Improve concurrent rendering behavior',
    });
    await expect(pullRequestLink).toBeVisible();
    await expect(pullRequestLink).toHaveAttribute(
      'href',
      'https://github.com/facebook/react/pull/101',
    );
    await expect(
      popup.locator('.review-inbox-item__reason--review-requested'),
    ).toHaveText('Review requested');
    await expect(
      popup.locator('.review-inbox-item__reason--assigned'),
    ).toHaveText('Assigned');

    await popup.getByRole('button', { name: /Recent/ }).click();
    await expect(
      popup.getByRole('link', { name: 'Refine developer tooling metadata' }),
    ).toBeVisible();
    await expect(
      popup.getByRole('link', { name: 'Improve concurrent rendering behavior' }),
    ).toHaveCount(0);
    await expect(
      popup.getByRole('link', { name: 'facebook/react' }),
    ).toHaveAttribute('href', 'https://github.com/facebook/react');

    const optionsPagePromise = context.waitForEvent('page');
    await popup.getByRole('button', { name: 'Open settings' }).click();
    const optionsPage = await optionsPagePromise;
    await expect(optionsPage).toHaveURL(/^chrome-extension:\/\/[^/]+\/options\.html$/);
    await expect(
      optionsPage.getByRole('heading', { name: 'GitHub access' }),
    ).toBeVisible();
    await expect(
      optionsPage.getByRole('heading', { name: 'Portable local data' }),
    ).toBeVisible();
    await expect(
      optionsPage.getByRole('button', { name: 'Export JSON' }),
    ).toBeVisible();
    await expect(
      optionsPage.getByLabel('Import JSON'),
    ).toBeVisible();
  } finally {
    await closeExtension(context);
  }
});

test('keeps partial inbox data and retries a failed section', async () => {
  const context = await test.step('launch extension', () => launchExtension());
  let assignedRequestCount = 0;

  try {
    await context.route('https://api.github.com/**', async (route) => {
      const kind = getSearchKind(route.request().url());
      if (kind === 'assigned') {
        assignedRequestCount += 1;
        if (assignedRequestCount === 1) {
          await fulfillJson(
            route,
            { message: 'Fixture search rate limit' },
            403,
          );
          return;
        }
        await fulfillJson(route, searchResponse(assignedItems));
        return;
      }
      if (kind === 'review-requests') {
        await fulfillJson(route, searchResponse([reviewRequestedItem]));
        return;
      }
      if (kind === 'recent-activity') {
        await fulfillJson(route, searchResponse(recentItems));
        return;
      }

      await fulfillJson(route, { message: 'Unexpected inbox fixture request' }, 404);
    });

    const serviceWorker = await test.step('bootstrap background worker', () =>
      bootstrapExtensionWorker(context),
    );
    await test.step('configure extension storage', () =>
      configureLocalCredential(serviceWorker),
    );
    const popup = await test.step('open popup page', () =>
      openExtensionPopup(context, serviceWorker),
    );

    await expect(
      popup.getByRole('link', { name: 'Improve concurrent rendering behavior' }),
    ).toBeVisible();
    await popup.getByRole('button', { name: /Assigned/ }).click();
    await expect(popup.getByRole('alert')).toContainText('Search limit reached');

    await popup.getByRole('button', { name: 'Retry' }).click();
    await expect(
      popup.getByRole('link', { name: 'Clarify React server component warnings' }),
    ).toBeVisible();
    expect(assignedRequestCount).toBe(2);
  } finally {
    await closeExtension(context);
  }
});

test('applies a saved filter to inbox items and section counts', async () => {
  const context = await launchExtension();
  try {
    await installSuccessfulSearchRoutes(context);
    const serviceWorker = await bootstrapExtensionWorker(context);
    await configureLocalCredential(serviceWorker);
    await configureWorkspacePreferences(serviceWorker, {
      savedFilters: {
        schemaVersion: 1,
        value: [{
          id: 'my-review-requests',
          name: 'My review requests',
          view: 'assigned',
          criteria: {
            repositories: [],
            authors: ['react-contributor'],
            draftState: 'ready',
          },
        }],
      },
    });
    const popup = await openExtensionPopup(context, serviceWorker);

    const filter = popup.getByLabel('Saved filter');
    await expect(filter).toBeVisible();
    await filter.selectOption('my-review-requests');
    await expect(popup.getByRole('button', { name: /Assigned 1/ })).toBeVisible();
    await expect(
      popup.getByRole('link', { name: 'Improve concurrent rendering behavior' }),
    ).toBeVisible();
    await expect(
      popup.getByRole('link', { name: 'Clarify React server component warnings' }),
    ).toHaveCount(0);
  } finally {
    await closeExtension(context);
  }
});

test('persists a saved filter after reopening the settings surface', async () => {
  const context = await launchExtension();
  try {
    const serviceWorker = await bootstrapExtensionWorker(context);
    await configureLocalCredential(serviceWorker);
    const popup = await openExtensionPopup(context, serviceWorker);
    const optionsPagePromise = context.waitForEvent('page');
    await popup.getByRole('button', { name: 'Open settings' }).click();
    const optionsPage = await optionsPagePromise;
    await expect(optionsPage.getByRole('heading', { name: 'Workspace preferences' })).toBeVisible();
    await optionsPage.getByLabel('Name').fill('Persisted queue');
    await optionsPage.getByLabel('Inbox view').selectOption('assigned');
    await optionsPage.getByLabel('Authors').fill('react-contributor');
    await optionsPage.getByRole('button', { name: 'Add filter' }).click();
    await expect(optionsPage.getByText('Persisted queue')).toBeVisible();
    await optionsPage.close();

    const reopened = await context.newPage();
    await reopened.goto(`chrome-extension://${getExtensionId(serviceWorker)}/options.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 5_000,
    });
    await expect(reopened.getByText('Persisted queue')).toBeVisible();
    await expect(reopened.getByRole('list', { name: 'Saved inbox filters' })).toContainText(
      'Assigned',
    );
  } finally {
    await closeExtension(context);
  }
});

test('applies a global feature-flag override without hiding other controls', async () => {
  const context = await launchExtension();
  try {
    await installSuccessfulSearchRoutes(context);
    await context.route('https://github.com/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<!doctype html><html><body>Repository fixture</body></html>',
        });
        return;
      }
      await route.abort('blockedbyclient');
    });
    const serviceWorker = await bootstrapExtensionWorker(context);
    await configureLocalCredential(serviceWorker);
    await configureWorkspacePreferences(serviceWorker, {
      savedFilters: {
        schemaVersion: 1,
        value: [{
          id: 'disabled-for-repository',
          name: 'Disabled for repository',
          view: 'reviewRequests',
          criteria: { repositories: [], authors: [], draftState: 'any' },
        }],
      },
      globalPreferences: {
        schemaVersion: 1,
        value: { featureFlags: { savedFilters: false } },
      },
    });
    const popup = await openExtensionPopup(context, serviceWorker);

    await expect(popup.getByLabel('Saved filter')).toHaveCount(0);
    await expect(popup.getByRole('region', { name: 'Command palette' })).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Open command palette' })).toBeVisible();
  } finally {
    await closeExtension(context);
  }
});
