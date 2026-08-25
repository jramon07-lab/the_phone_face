const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

test('capturas: home, WhatsApp y automatizaciones', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.screenshot({ path: 'test-results/control-2-home.png', fullPage: true });

  const wa = page.locator('.nav[data-view="whatsapplive"]').first();
  await wa.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/control-2-whatsapp.png', fullPage: true });

  const auto = page.locator('.nav[data-view="automations"]').first();
  await auto.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/control-2-automations.png', fullPage: true });
});
