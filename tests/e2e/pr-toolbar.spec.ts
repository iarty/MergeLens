import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';
import {
  configureLocalCredential,
  launchExtension,
  waitForExtensionWorker,
} from './extension';

const fixturePath = path.resolve(import.meta.dirname, 'fixtures/github-pr.html');
const githubFixtureUrl = 'https://github.com/facebook/react/pull/42';
const openGitHubFixture = async (page: Page) => {
  await page.goto(githubFixtureUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 5_000,
  });
};

const pullRequestResponse = (pullNumber: number) => ({
  html_url: `https://github.com/facebook/react/pull/${pullNumber}`,
  title: `React pull request ${pullNumber}`,
  state: 'open',
  merged: false,
  draft: false,
  user: { login: 'react-contributor' },
  head: { sha: `fixture-sha-${pullNumber}` },
});

const checkRunsResponse = {
  total_count: 2,
  check_runs: [
    {
      id: 1,
      name: 'Unit tests',
      status: 'completed',
      conclusion: 'success',
      details_url: 'https://github.com/facebook/react/actions/runs/1',
    },
    {
      id: 2,
      name: 'Browser tests',
      status: 'in_progress',
      conclusion: null,
      details_url: null,
    },
  ],
};

const deploymentsResponse = [
  {
    id: 7,
    environment: 'Preview',
    sha: 'fixture-sha-42',
    statuses_url: 'https://api.github.com/repos/facebook/react/deployments/7/statuses',
  },
];

const deploymentStatusesResponse = [
  {
    state: 'success',
    environment_url: 'https://preview.example.com/react/42',
    target_url: null,
    updated_at: '2026-08-14T01:00:00Z',
    created_at: '2026-08-14T00:55:00Z',
  },
];

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
};

const installRoutes = async (context: BrowserContext) => {
  const fixture = await readFile(fixturePath, 'utf8');
  await context.route('https://github.com/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
      return;
    }

    await route.abort('blockedbyclient');
  });
  await context.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url());
    const pullMatch = url.pathname.match(/^\/repos\/facebook\/react\/pulls\/(\d+)$/);
    if (pullMatch) {
      const pullNumber = Number(pullMatch[1]);
      await new Promise((resolve) => setTimeout(resolve, 150));
      await fulfillJson(route, pullRequestResponse(pullNumber));
      return;
    }

    if (url.pathname.includes('/check-runs')) {
      await fulfillJson(route, checkRunsResponse);
      return;
    }

    if (url.pathname === '/repos/facebook/react/deployments') {
      await fulfillJson(route, deploymentsResponse);
      return;
    }

    if (url.pathname === '/repos/facebook/react/deployments/7/statuses') {
      await fulfillJson(route, deploymentStatusesResponse);
      return;
    }

    await fulfillJson(route, { message: 'Unexpected fixture request' }, 404);
  });
};

test('mounts exactly one toolbar across GitHub SPA navigation', async () => {
  const context = await launchExtension();
  try {
    await installRoutes(context);
    const page = await context.newPage();
    const serviceWorkerPromise = waitForExtensionWorker(context);
    await openGitHubFixture(page);
    await configureLocalCredential(await serviceWorkerPromise);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 5_000 });

    const toolbarHost = page.locator('mergelens-pr-toolbar');
    await expect(toolbarHost).toHaveCount(1);
    await expect.poll(async () => {
      return toolbarHost.evaluate((host) => {
        const hostWidth = host.getBoundingClientRect().width;
        const parent = host.parentElement;
        if (!parent) return Number.POSITIVE_INFINITY;
        const styles = getComputedStyle(parent);
        const contentWidth =
          parent.clientWidth -
          Number.parseFloat(styles.paddingLeft) -
          Number.parseFloat(styles.paddingRight);
        return Math.abs(contentWidth - hostWidth);
      });
    }).toBeLessThanOrEqual(1);
    await expect.poll(async () => {
      return toolbarHost.evaluate((host) => host.parentElement?.id);
    }).toBe('diff-comparison-viewer-container');
    await expect.poll(async () => {
      return toolbarHost.evaluate((host) => {
        return host.previousElementSibling?.getAttribute('data-component');
      });
    }).toBe('SplitPageLayout.Header');
    await expect(page.getByRole('status')).toContainText('Loading pull request');
    await expect(page.getByRole('link', { name: 'React pull request 42' })).toBeVisible();
    await expect(page.getByText('Unit tests')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Preview: success' })).toHaveAttribute(
      'href',
      'https://preview.example.com/react/42',
    );

    await page.getByRole('button', { name: 'Remove toolbar' }).click();
    await expect(toolbarHost).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'React pull request 42' })).toBeVisible();

    await page.getByRole('button', { name: 'Replace header' }).click();
    await expect(toolbarHost).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'React pull request 42' })).toBeVisible();

    await page.getByRole('button', { name: 'Same PR' }).click();
    await expect(page).toHaveURL(/\/pull\/42\/files$/);
    await expect(toolbarHost).toHaveCount(1);

    await page.getByRole('button', { name: 'Next PR' }).click();
    await expect(page).toHaveURL(/\/pull\/43$/);
    await expect(page.getByRole('link', { name: 'React pull request 43' })).toBeVisible();
    await expect(toolbarHost).toHaveCount(1);

    await page.getByRole('button', { name: 'Repository' }).click();
    await expect(page).toHaveURL(/\/facebook\/react$/);
    await expect(toolbarHost).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('renders a stable error when GitHub API fails', async () => {
  const context = await launchExtension();
  try {
    const fixture = await readFile(fixturePath, 'utf8');
    await context.route('https://github.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: fixture }),
    );
    await context.route('https://api.github.com/**', (route) =>
      fulfillJson(route, { message: 'Fixture service unavailable' }, 503),
    );
    const page = await context.newPage();
    const serviceWorkerPromise = waitForExtensionWorker(context);
    await openGitHubFixture(page);
    await configureLocalCredential(await serviceWorkerPromise);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 5_000 });

    await expect(page.getByRole('alert')).toContainText('GitHub is unreachable');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.locator('mergelens-pr-toolbar')).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test('keeps private notes available through API errors and PR navigation', async () => {
  const context = await launchExtension();
  try {
    const fixture = await readFile(fixturePath, 'utf8');
    await context.route('https://github.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: fixture }),
    );
    await context.route('https://api.github.com/**', (route) =>
      fulfillJson(route, { message: 'Fixture service unavailable' }, 503),
    );

    const page = await context.newPage();
    await openGitHubFixture(page);
    const toolbarHost = page.locator('mergelens-pr-toolbar');
    await expect(toolbarHost).toHaveCount(1);
    await page.getByRole('button', { name: 'Notes' }).click();

    const editor = page.getByRole('textbox', { name: 'Pull request note' });
    await expect(editor).toBeVisible();
    await editor.fill('Private PR 42 observation');
    await expect(page.getByRole('status')).toContainText('Saved', { timeout: 5_000 });

    await page.getByRole('button', { name: 'Same PR' }).click();
    await expect(page).toHaveURL(/\/pull\/42\/files$/);
    await expect(page.getByRole('textbox', { name: 'Pull request note' })).toHaveValue(
      'Private PR 42 observation',
    );

    await page.getByRole('button', { name: 'Next PR' }).click();
    await expect(page).toHaveURL(/\/pull\/43$/);
    await expect(page.getByRole('textbox', { name: 'Pull request note' })).toHaveValue('');
  } finally {
    await context.close();
  }
});

test('restores an edited local review workspace after its host is replaced', async () => {
  const context = await launchExtension();
  try {
    const fixture = await readFile(fixturePath, 'utf8');
    await context.route('https://github.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: fixture }),
    );
    await context.route('https://api.github.com/**', (route) =>
      fulfillJson(route, { message: 'Fixture service unavailable' }, 503),
    );
    const page = await context.newPage();
    await openGitHubFixture(page);
    await page.getByRole('button', { name: 'Notes' }).click();
    const editor = page.getByRole('textbox', { name: 'Pull request note' });
    await editor.fill('Draft survives host replacement');

    await page.getByRole('button', { name: 'Remove toolbar' }).click();
    await expect(page.locator('mergelens-pr-toolbar')).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Pull request note' })).toHaveValue(
      'Draft survives host replacement',
    );

    await page.getByRole('button', { name: 'Replace header' }).click();
    await expect(page.locator('mergelens-pr-toolbar')).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Pull request note' })).toHaveValue(
      'Draft survives host replacement',
    );
  } finally {
    await context.close();
  }
});

test('opens the extension options page from the injected toolbar', async () => {
  const context = await launchExtension();
  try {
    const fixture = await readFile(fixturePath, 'utf8');
    await context.route('https://github.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: fixture }),
    );
    const page = await context.newPage();
    await openGitHubFixture(page);

    const optionsPagePromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Open settings' }).click();
    const optionsPage = await optionsPagePromise;

    await expect(optionsPage).toHaveURL(/^chrome-extension:\/\/[^/]+\/options\.html$/);
    await expect(optionsPage.getByRole('heading', { name: 'GitHub access' })).toBeVisible();
  } finally {
    await context.close();
  }
});
