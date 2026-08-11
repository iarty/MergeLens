import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'MergeLens',
    description: 'A cross-browser GitHub workflow companion',
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
