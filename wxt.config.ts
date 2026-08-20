import { defineConfig } from 'wxt'

const rawUnicodeNoncharacter = String.fromCharCode(0xffff)

// See https://wxt.dev/api/config.html
export default defineConfig({
  modulesDir: '.wxt-modules',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [
      {
        name: 'escape-extension-noncharacters',
        enforce: 'post',
        generateBundle(_options, bundle) {
          for (const output of Object.values(bundle)) {
            if (
              output.type !== 'chunk' ||
              !output.code.includes(rawUnicodeNoncharacter)
            ) {
              continue
            }
            output.code = output.code.replaceAll(
              rawUnicodeNoncharacter,
              '\\uFFFF',
            )
          }
        },
      },
    ],
  }),
  manifest: {
    name: 'MergeLens',
    description: 'A cross-browser GitHub workflow companion',
    permissions: ['storage', 'alarms'],
    optional_permissions: ['notifications'],
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
})
