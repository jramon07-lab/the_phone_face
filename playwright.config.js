const { defineConfig } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const vercelBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!baseURL) {
  throw new Error('PLAYWRIGHT_BASE_URL is required');
}
if (!vercelBypass) {
  throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required');
}

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': vercelBypass
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'desktop-1100', use: { viewport: { width: 1100, height: 800 } } }
  ]
});
