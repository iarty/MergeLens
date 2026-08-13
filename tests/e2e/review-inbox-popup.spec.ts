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
