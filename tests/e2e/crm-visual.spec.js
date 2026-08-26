const { test, expect } = require('@playwright/test');

async function login(page){
  const email = process.env.CRM_TEST_EMAIL;
  const password = process.env.CRM_TEST_PASSWORD;
  if (!email || !password) throw new Error('CRM_TEST_EMAIL and CRM_TEST_PASSWORD are required');

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

test('CRM visible real: menú, plantillas y build correctos', async ({ page }) => {
  await login(page);

  await expect(page.locator('.nav[data-view="search"][data-sheet="LIQUIDACION"]')).toBeHidden();
  await expect(page.locator('.nav[data-view="search"][data-sheet="DATA"]')).toBeHidden();
  await expect(page.locator('.nav[data-view="search"][data-sheet="CLAWBACK"]')).toBeHidden();
  await expect(page.locator('.nav[data-view="search"][data-sheet="AJUSTES"]')).toBeHidden();

  await expect(page.locator('#tpfWaTemplatesNav')).toBeVisible();
  await expect(page.locator('#tpfBuildBadge')).toBeVisible();

  await page.screenshot({ path: 'test-results/home-after-login.png', fullPage: true });
});

test('Plantillas WhatsApp abre de verdad', async ({ page }) => {
  await login(page);
  await page.locator('#tpfWaTemplatesNav').click();
  await expect(page.locator('#waTemplateModal')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'test-results/whatsapp-templates.png', fullPage: true });
});

test('Automatizaciones muestra constructor avanzado y presets reales', async ({ page }) => {
  await login(page);
  await page.locator('.nav[data-view="automations"]').click();
  await expect(page.locator('#view-automations')).toBeVisible({ timeout: 15000 });
  const bar=page.locator('#tpfAutomationAdvancedBar');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('Constructor avanzado');
  await expect(bar).toContainText('Motor completo activo');
  await expect(bar.locator('[data-auto-preset]')).toHaveCount(3);

  await bar.locator('[data-auto-preset="renewal"]').click();
  await expect(page.locator('#auto2Trigger')).toHaveValue('message_contains');
  await expect(page.locator('#auto2Action')).toHaveValue('assign_label');
  await expect(page.locator('#auto2Keyword')).toHaveValue('renovación');

  await bar.locator('[data-auto-preset="unanswered"]').click();
  await expect(page.locator('#auto2Trigger')).toHaveValue('unanswered');
  await expect(page.locator('#auto2Action')).toHaveValue('create_task');
  await expect(page.locator('#auto2UnansweredMinutes')).toHaveValue('120');

  await bar.locator('[data-auto-preset="sequence"]').click();
  await expect(page.locator('#auto2Trigger')).toHaveValue('label_assigned');
  await expect(page.locator('#auto2Action')).toHaveValue('sequence_label_opportunity_whatsapp');
  await expect(page.locator('#auto2SeqDays')).toHaveValue('7');

  await page.screenshot({ path: 'test-results/automations-advanced.png', fullPage: true });
});

test('Sin errores JavaScript graves al iniciar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e.message || e)));
  await login(page);
  await page.waitForTimeout(2500);
  expect(errors, `Errores JS detectados:\n${errors.join('\n---\n')}`).toEqual([]);
});
