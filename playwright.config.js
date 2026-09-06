const { defineConfig } = require('@playwright/test');

const baseURL = process.env.VERCEL_PREVIEW_URL || process.env.PLAYWRIGHT_BASE_URL;
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!baseURL) throw new Error('VERCEL_PREVIEW_URL or PLAYWRIGHT_BASE_URL is required');
if (!bypass) throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': bypass,
      'x-vercel-set-bypass-cookie': 'true'
    }
  }
});
