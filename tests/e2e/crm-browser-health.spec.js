const { test, expect } = require('@playwright/test');

test('CRM principal, móvil e integraciones críticas están operativos', async ({ page }) => {
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.message||error)));

  const state=await page.request.get('/api/green?action=state');
  expect(state.ok()).toBeTruthy();
  expect((await state.json()).state).toBe('authorized');

  const health=await page.request.get('/api/green-health');
  expect(health.ok()).toBeTruthy();
  const healthData=await health.json();
  expect(healthData.providerHealthy).toBe(true);
  expect(healthData.degraded).toBe(false);

  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});

  await expect(page.locator('.nav[data-view="agenda"]').first()).toBeVisible();
  await expect(page.locator('.nav[data-view="automations"]').first()).toBeVisible();
  await expect(page.locator('#tpfWaTemplatesV3Nav')).toBeVisible({timeout:15000});
  await expect(page.getByText('Plantillas WhatsApp',{exact:true})).toHaveCount(1);
  await page.locator('#tpfWaTemplatesV3Nav').click();
  await expect(page.locator('#view-wa-templates-v3')).toBeVisible({timeout:15000});
  await expect(page.locator('#view-wa-templates-v3 .tv3Search')).toBeVisible();

  await page.goto('/movil/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#mobileBoot')).toBeHidden({timeout:15000});
  await expect(page.locator('#mobileLogin:not(.hidden), #mobileApp:not(.hidden)')).toHaveCount(1);

  expect(pageErrors,`Errores JavaScript: ${pageErrors.join(' | ')}`).toEqual([]);
});
