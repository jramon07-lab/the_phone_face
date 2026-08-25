const { test, expect } = require('@playwright/test');
const percySnapshot = require('@percy/playwright');

async function login(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

test('Percy: vistas críticas del CRM', async ({ page }) => {
  await login(page);
  await percySnapshot(page, 'CRM Home');

  const wa = page.locator('.nav[data-view="whatsapplive"]').first();
  await wa.click();
  await page.waitForTimeout(400);
  await percySnapshot(page, 'CRM WhatsApp');

  const auto = page.locator('.nav[data-view="automations"]').first();
  await auto.click();
  await page.waitForTimeout(400);
  await percySnapshot(page, 'CRM Automatizaciones');
});
