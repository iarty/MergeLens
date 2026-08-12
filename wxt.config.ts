import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modulesDir: '.wxt-modules',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'MergeLens',
    description: 'A cross-browser GitHub workflow companion',
    permissions: ['storage'],
    host_permissions: ['https://api.github.com/*'],
    browser_specific_settings: {
      gecko: {
        id: 'mergelens@abarbonov.dev',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
});
