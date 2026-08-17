import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  configureWorkspacePreferences,
  launchExtension,
  waitForExtensionWorker,
} from './extension';

const fixturePath = path.resolve(import.meta.dirname, 'fixtures/github-command-palette.html');
const githubFixtureUrl = 'https://github.com/facebook/react/pull/42';

const openFixture = async (page: Page): Promise<void> => {
  await page.goto(githubFixtureUrl, { waitUntil: 'domcontentloaded', timeout: 5_000 });
};

const installFixtureRoutes = async (context: BrowserContext): Promise<void> => {
  const fixture = await readFile(fixturePath, 'utf8');
  await context.route('https://github.com/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
      return;
    }

    await route.abort('blockedbyclient');
  });
  await context.route('https://api.github.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Fixture API response' }),
    }),
  );
};

const paletteHost = (page: Page) => page.locator('mergelens-command-palette');

test('keeps Chrome and Firefox manifests within the existing permission boundary', async () => {
  const manifests = await Promise.all([
    readFile(path.resolve(import.meta.dirname, '../../.output/chrome-mv3/manifest.json'), 'utf8'),
    readFile(path.resolve(import.meta.dirname, '../../.output/firefox-mv2/manifest.json'), 'utf8'),
  ]);

  for (const manifestText of manifests) {
    const manifest = JSON.parse(manifestText) as {
      permissions?: string[];
      host_permissions?: string[];
    };
    const permissions = new Set([
      ...(manifest.permissions ?? []),
      ...(manifest.host_permissions ?? []),
    ]);
    expect([...permissions].sort()).toEqual(['https://api.github.com/*', 'storage']);
  }
});

test('opens, searches, executes, and closes the command palette', async () => {
  const context = await launchExtension();
  try {
    await installFixtureRoutes(context);
    const page = await context.newPage();
    const worker = await waitForExtensionWorker(context);
    await openFixture(page);

    const nativeSearch = page.locator('#native-search');
    await nativeSearch.focus();
    await nativeSearch.press('Control+K');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const opener = page.locator('#same-pr');
    await opener.focus();
    await page.keyboard.press('Control+K');
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('searchbox')).toBeFocused();

    await dialog.getByRole('searchbox').fill('actions');
    await expect(dialog.getByRole('option', { name: 'Open Actions and checks' })).toBeVisible();
    await dialog.getByRole('searchbox').press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();

    await page.keyboard.press('Control+K');
    const commandSearch = page.getByRole('dialog').getByRole('searchbox');
    await commandSearch.fill('refresh toolbar');
    await commandSearch.press('Enter');
    await expect(page).toHaveURL(/\/facebook\/react\/pull\/42$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(paletteHost(page)).toHaveCount(1);
    await expect(worker).toBeTruthy();
  } finally {
    await context.close();
  }
});

test('keeps the page interactive while the palette is closed and follows SPA navigation', async () => {
  const context = await launchExtension();
  try {
    await installFixtureRoutes(context);
    const page = await context.newPage();
    await waitForExtensionWorker(context);
    await openFixture(page);

    const host = paletteHost(page);
    await expect(host).toHaveCount(1);
    await expect(host).toHaveCSS('position', 'relative');
    await expect(page.locator('#next-pr')).toBeEnabled();
    await page.locator('#next-pr').click();
    await expect(page).toHaveURL(/\/facebook\/react\/pull\/43$/);

    await page.keyboard.press('Control+K');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#repository')).toBeEnabled();
  } finally {
    await context.close();
  }
});

test('uses the configured shortcut while keeping editable inputs safe', async () => {
  const context = await launchExtension();
  try {
    await installFixtureRoutes(context);
    const page = await context.newPage();
    const worker = await waitForExtensionWorker(context);
    await configureWorkspacePreferences(worker, {
      globalPreferences: {
        schemaVersion: 1,
        value: {
          featureFlags: { customCommandPaletteShortcut: true },
          commandPaletteShortcut: 'primary-shift-p',
        },
      },
    });
    await openFixture(page);

    const nativeSearch = page.locator('#native-search');
    await nativeSearch.focus();
    await page.keyboard.press('Control+Shift+P');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.locator('#same-pr').focus();
    await page.keyboard.press('Control+Shift+P');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await expect(page.getByRole('dialog').locator('kbd')).toContainText('Ctrl / Cmd Shift P');
  } finally {
    await context.close();
  }
});
