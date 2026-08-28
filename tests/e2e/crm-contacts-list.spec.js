const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function login(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

test('contactos: nueva pantalla, filtros, etiquetas, ficha y alta visibles', async ({ page }) => {
  await login(page);

  await page.locator('.nav[data-view="database"]').click();
  const app = page.locator('#tpfContactsApp');
  await expect(app).toBeVisible({ timeout: 30000 });

  await expect(page.locator('#tpfContactsSearch')).toBeVisible();
  await expect(page.locator('#tpfFilterName')).toBeVisible();
  await expect(page.locator('#tpfFilterDni')).toBeVisible();
  await expect(page.locator('#tpfFilterPhone')).toBeVisible();
  await expect(page.locator('#tpfFilterSource')).toBeVisible();
  await expect(page.locator('#tpfFilterLabel')).toBeVisible();
  await expect(page.locator('#tpfContactsExport')).toBeVisible();
  await expect(page.locator('#tpfContactsAdd')).toBeVisible();
  await expect(page.locator('#view-database > .tpfContactsLegacy')).toBeHidden();

  await expect(page.locator('#tpfContactsLoading')).toBeHidden({ timeout: 30000 });

  await page.locator('#tpfContactsAdd').click();
  await expect(page.locator('#tpfContactsCreateBack')).toBeVisible();
  await expect(page.locator('#tpfCreateFirst')).toBeVisible();
  await expect(page.locator('#tpfCreateLast')).toBeVisible();
  await expect(page.locator('#tpfCreateBank')).toBeVisible();
  await expect(page.locator('#tpfCreateNotes')).toBeVisible();
  await expect(page.locator('#tpfCreateObs')).toBeVisible();
  await expect(page.locator('#tpfCreateLabels')).toBeVisible();
  await page.locator('#tpfContactsCreateCancel').click();
  await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();

  const rows = page.locator('#tpfContactsRows tr');
  if (await rows.count()) {
    const first = rows.first();
    await expect(first.locator('[data-action="whatsapp"]')).toBeVisible();
    await expect(first.locator('[data-action="schedule"]')).toBeVisible();
    await expect(first.locator('.tpfContactPencil')).toBeVisible();
    await first.locator('[data-action="open"]').first().click();
    await expect(page.locator('#contactModal')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#tpfContactEditToggle')).toBeVisible({ timeout: 10000 });
    await page.locator('#contactClose').click();
  }

  fs.mkdirSync('browser-evidence', { recursive: true });
  await page.screenshot({ path: 'browser-evidence/contacts-list.png', fullPage: true });
});
