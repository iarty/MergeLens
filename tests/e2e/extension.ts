import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '../..');
export const chromeExtensionPath = path.join(projectRoot, '.output/chrome-mv3');

export const buildExtension = async (): Promise<void> => {
  try {
    await execFileAsync('npm', ['run', 'build'], { cwd: projectRoot });
    await execFileAsync('npm', ['run', 'build:firefox'], { cwd: projectRoot });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error
      ? String(error.stderr)
      : String(error);
    throw new Error(`Extension build failed before Playwright startup: ${stderr}`);
  }
};

export const launchExtension = async (): Promise<BrowserContext> => {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'mergelens-playwright-'));

  try {
    return await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${chromeExtensionPath}`,
        `--load-extension=${chromeExtensionPath}`,
      ],
    });
  } catch (error) {
    throw new Error(
      `Chromium extension startup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const configureLocalCredential = async (
  serviceWorker: Worker,
): Promise<void> => {
  await Promise.race([
    serviceWorker.evaluate(async () => {
      await browser.storage.local.set({ githubToken: 'fixture-credential' });
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timed out while configuring extension-local test storage'));
      }, 5_000);
    }),
  ]);
};

export const configureWorkspacePreferences = async (
  serviceWorker: Worker,
  records: {
    savedFilters?: unknown;
    globalPreferences?: unknown;
    repositoryPreferences?: unknown;
  },
): Promise<void> => {
  await serviceWorker.evaluate(async (nextRecords) => {
    await browser.storage.sync.set({
      ...(nextRecords.savedFilters === undefined
        ? {}
        : { 'workspacePreferences.savedFilters': nextRecords.savedFilters }),
      ...(nextRecords.globalPreferences === undefined
        ? {}
        : { 'workspacePreferences.global': nextRecords.globalPreferences }),
      ...(nextRecords.repositoryPreferences === undefined
        ? {}
        : { 'workspacePreferences.repositories': nextRecords.repositoryPreferences }),
    });
  }, records);
};

export const waitForExtensionWorker = (
  context: BrowserContext,
): Promise<Worker> => {
  const existingWorker = context.serviceWorkers()[0];
  if (existingWorker) {
    return Promise.resolve(existingWorker);
  }

  return context.waitForEvent('serviceworker', { timeout: 5_000 }).catch((error) => {
    throw new Error(
      `MergeLens background worker did not start after content injection: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
};

export const bootstrapExtensionWorker = async (
  context: BrowserContext,
): Promise<Worker> => {
  const bootstrapPage = await context.newPage();
  await context.route('https://github.com/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body></body></html>',
      });
      return;
    }

    await route.abort('blockedbyclient');
  });

  const workerPromise = waitForExtensionWorker(context);
  await bootstrapPage.goto('https://github.com/facebook/react/pull/42', {
    waitUntil: 'domcontentloaded',
    timeout: 5_000,
  });
  const worker = await workerPromise;
  await bootstrapPage.close({ runBeforeUnload: false });
  return worker;
};

export const closeExtension = async (
  context: BrowserContext,
): Promise<void> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      context.close(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Timed out while closing extension browser context'));
        }, 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getExtensionId = (serviceWorker: Worker): string => {
  const extensionId = new URL(serviceWorker.url()).host;
  if (!extensionId) {
    throw new Error('Unable to resolve MergeLens extension ID from service worker');
  }

  return extensionId;
};

export const openExtensionPopup = async (
  context: BrowserContext,
  serviceWorker: Worker,
): Promise<Page> => {
  const page = await context.newPage();
  const popupUrl = `chrome-extension://${getExtensionId(serviceWorker)}/popup.html`;

  try {
    await page.goto(popupUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 5_000,
    });
    return page;
  } catch (error) {
    throw new Error(
      `MergeLens popup startup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
