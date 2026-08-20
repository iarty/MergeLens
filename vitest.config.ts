import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'https://github.com/',
      },
    },
    setupFiles: ['./tests/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
})
