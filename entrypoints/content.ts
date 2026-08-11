export default defineContentScript({
  matches: ['https://github.com/*'],
  main() {
    console.log('MergeLens content script loaded.');
  },
});
