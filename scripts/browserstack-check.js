const { chromium } = require('@playwright/test');
const cp = require('child_process');

(async () => {
  const username = process.env.BROWSERSTACK_USERNAME;
  const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;
  const localIdentifier = process.env.BROWSERSTACK_LOCAL_IDENTIFIER;
  const email = process.env.CRM_TEST_EMAIL;
  const password = process.env.CRM_TEST_PASSWORD;
  if (!username || !accessKey || !email || !password) throw new Error('Faltan secretos BrowserStack o CRM');

  const clientPlaywrightVersion = cp.execSync('npx playwright --version').toString().trim().split(' ')[1];
  const caps = {
    browser: 'chrome',
    os: 'Windows',
    os_version: '11',
    name: 'The Phone Face CRM critical check',
    build: process.env.GITHUB_SHA || 'local',
    project: 'The Phone Face CRM',
    'browserstack.local': 'true',
    'browserstack.localIdentifier': localIdentifier,
    'browserstack.username': username,
    'browserstack.accessKey': accessKey,
    'client.playwrightVersion': clientPlaywrightVersion,
    'browserstack.debug': 'true',
    'browserstack.console': 'info',
    'browserstack.networkLogs': 'true'
  };

  const browser = await chromium.connect({
    wsEndpoint: `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`
  });
  const page = await browser.newPage();
  let passed = false;
  let reason = 'Unknown';
  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#login').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#signin').click();
    await page.locator('#app').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#tpfWaTemplatesNav').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.nav[data-view="automations"]').first().waitFor({ state: 'visible', timeout: 15000 });
    passed = true;
    reason = 'Login and critical navigation passed';
  } catch (error) {
    reason = String(error?.message || error).slice(0, 500);
    throw error;
  } finally {
    try {
      await page.evaluate(() => {}, `browserstack_executor: ${JSON.stringify({ action: 'setSessionStatus', arguments: { status: passed ? 'passed' : 'failed', reason } })}`);
    } catch (_) {}
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
