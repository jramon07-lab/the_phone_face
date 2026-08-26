const { test, expect } = require('@playwright/test');

async function login(page){
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

async function moduleState(page,name){
  return page.evaluate(n => window.TPFModules?.status().find(x => x.name === n) || null, name);
}

async function expectModuleReady(page,name){
  const state=await moduleState(page,name);
  expect(state, `Módulo ${name} no registrado`).not.toBeNull();
  expect(['ready','ok'], `Módulo ${name} en estado ${state?.state}`).toContain(state.state);
}

test('runtime: un fallo aislado no rompe el CRM', async ({ page }) => {
  await login(page);
  const result = await page.evaluate(() => {
    const modules = window.TPFModules;
    if(!modules) return { runtime:false };
    modules.clearErrors();
    const guarded = modules.guard('isolation-test', () => { throw new Error('fallo-controlado'); });
    guarded();
    return {
      runtime:true,
      appVisible: !document.getElementById('app')?.classList.contains('hidden'),
      isolated: modules.status().find(x => x.name === 'isolation-test')?.state === 'error',
      hasError: modules.errors().some(x => x.module === 'isolation-test')
    };
  });
  expect(result.runtime).toBe(true);
  expect(result.appVisible).toBe(true);
  expect(result.isolated).toBe(true);
  expect(result.hasError).toBe(true);
  await page.locator('.nav[data-view="sales"]').click();
  await expect(page.locator('#view-sales')).toBeVisible();
});

test('módulo WhatsApp: está aislado y su vista abre', async ({ page }) => {
  await login(page);
  await expectModuleReady(page,'whatsapp');
  const nav=page.locator('.nav[data-view="whatsapplive"]');
  if(await nav.count()){
    await nav.click();
    await expect(page.locator('#view-whatsapplive')).toBeVisible();
  }
});

test('módulo Agenda: está aislado y su vista abre', async ({ page }) => {
  await login(page);
  await expectModuleReady(page,'agenda');
  const nav=page.locator('.nav[data-view="agenda"]');
  if(await nav.isVisible()){
    await nav.click();
    await expect(page.locator('#view-agenda')).toBeVisible();
  }
});

test('módulo Contactos/Ventas: está aislado y Ventas abre', async ({ page }) => {
  await login(page);
  await expectModuleReady(page,'contacts-sales');
  const nav=page.locator('.nav[data-view="sales"]');
  await expect(nav).toBeVisible();
  await nav.click();
  await expect(page.locator('#view-sales')).toBeVisible();
});

test('módulo Automatizaciones/Ajustes: está aislado y constructor abre', async ({ page }) => {
  await login(page);
  await expectModuleReady(page,'automations-settings');
  const nav=page.locator('.nav[data-view="automations"]');
  if(await nav.isVisible()){
    await nav.click();
    await expect(page.locator('#view-automations')).toBeVisible();
    await expect(page.locator('#tpfAutomationAdvancedBar')).toBeVisible();
  }
});

test('módulo Estado del sistema: respeta permisos y muestra módulos al admin', async ({ page }) => {
  await login(page);
  await expectModuleReady(page,'system-status');
  const isAdmin = await page.evaluate(() => {
    try { return typeof perms !== 'undefined' && !!perms?.is_admin; } catch (_) { return false; }
  });
  const nav=page.locator('.nav[data-view="system"]');
  if(isAdmin){
    await expect(nav).toBeVisible();
    await nav.click();
    await expect(page.locator('#view-system')).toBeVisible();
    await expect(page.locator('#tpfModuleStatusCard')).toBeVisible({timeout:10000});
  }else{
    await expect(nav).toBeHidden();
  }
});
