const { test, expect } = require('@playwright/test');

async function login(page){
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

test('módulos: un fallo aislado no rompe el CRM', async ({ page }) => {
  await login(page);
  const result = await page.evaluate(() => {
    const modules = window.TPFModules;
    if(!modules) return { runtime:false };
    const guarded = modules.guard('isolation-test', () => { throw new Error('fallo-controlado'); });
    guarded();
    return {
      runtime:true,
      appVisible: !document.getElementById('app')?.classList.contains('hidden'),
      states: modules.status().map(x => ({name:x.name,state:x.state})),
      hasError: modules.errors().some(x => x.module === 'isolation-test')
    };
  });

  expect(result.runtime).toBe(true);
  expect(result.appVisible).toBe(true);
  expect(result.hasError).toBe(true);
  for (const name of ['whatsapp','agenda','contacts-sales','automations-settings','system-status']) {
    expect(result.states.some(x => x.name === name && ['ready','ok'].includes(x.state))).toBe(true);
  }

  await page.locator('.nav[data-view="sales"]').click();
  await expect(page.locator('#view-sales')).toBeVisible();
  await page.locator('.nav[data-view="agenda"]').click();
  await expect(page.locator('#view-agenda')).toBeVisible();
});
