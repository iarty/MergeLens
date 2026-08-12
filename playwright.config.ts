import { defineConfig } from '@playwright/test';

const isDebugLoggingEnabled = process.env.LOG_LEVEL?.toLowerCase() === 'debug';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    actionTimeout: 5_000,
    trace: isDebugLoggingEnabled ? 'retain-on-failure' : 'off',
  },
});
