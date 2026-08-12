import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  chromium,
  type BrowserContext,
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
