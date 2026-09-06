const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

test('funcional/permisos: módulos críticos visibles y salida accesible', async ({ page }) => {
  await login(page);

  await expect(page.locator('.nav[data-view="search"][data-sheet="LIQUIDACION"]')).toBeHidden();
  await expect(page.locator('.nav[data-view="search"][data-sheet="DATA"]')).toBeHidden();
  await expect(page.locator('.nav[data-view="search"][data-sheet="CLAWBACK"]')).toBeHidden();
  await expect(page.locator('.nav[data-view="search"][data-sheet="AJUSTES"]')).toBeHidden();

  await expect(page.locator('#tpfWaTemplatesV3Nav')).toBeVisible();
  await expect(page.locator('.nav[data-view="automations"]').first()).toBeVisible();
  await expect(page.locator('.nav[data-view="agenda"]').first()).toBeVisible();

  const logout = page.locator('#logout');
  await expect(logout).toBeVisible();
});
