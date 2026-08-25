const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

test('smoke: entrada, login y navegación crítica sin errores JS', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  await login(page);
  const selectors = [
    '.nav[data-view="whatsapplive"]',
    '.nav[data-view="automations"]',
    '.nav[data-view="agenda"]'
  ];
  for (const selector of selectors) {
    const nav = page.locator(selector).first();
    if (await nav.count()) {
      await nav.click();
      await page.waitForTimeout(300);
    }
  }
  expect(errors, `Errores JS: ${errors.join(' | ')}`).toEqual([]);
});
