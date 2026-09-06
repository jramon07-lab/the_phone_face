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
  await expect(page.locator('#tpfWaTemplatesV3Nav')).toBeVisible();
  await expect(page.locator('#tpfBuildBadge')).toBeAttached();
  await page.screenshot({ path: 'test-results/home-after-login.png', fullPage: true });
});

test('Plantillas WhatsApp abre como página independiente con buscador', async ({ page }) => {
  await login(page);
  await page.locator('#tpfWaTemplatesV3Nav').click();
  const library=page.locator('#view-wa-templates-v3');
  await expect(library).toBeVisible({ timeout: 15000 });
  await expect(library.getByRole('heading',{name:'Plantillas WhatsApp'})).toBeVisible();
  await expect(library.locator('.tv3Search')).toBeVisible();
  await expect(page.locator('#waTemplateModal')).toBeHidden();
  await page.screenshot({ path: 'test-results/whatsapp-templates.png', fullPage: true });
});

test('Automatizaciones muestra constructor libre y pasos configurables', async ({ page }) => {
  await login(page);
  await page.locator('.nav[data-view="automations"]').click();
  await expect(page.locator('#view-automations')).toBeVisible({ timeout: 15000 });
  const builder=page.locator('#tpfFlowBuilder');
  await expect(builder).toBeVisible({ timeout: 15000 });
  await expect(builder).toContainText('Constructor libre de automatizaciones');
  await expect(builder.locator('[data-add="action"]')).toBeVisible();
  await expect(builder.locator('[data-add="wait"]')).toBeVisible();
  await expect(builder.locator('[data-add="condition"]')).toBeVisible();
  await expect(builder.locator('[data-add="repeat"]')).toBeVisible();
  const serverMode=await page.evaluate(()=>({flag:window.TPF_SERVER_AUTOMATIONS===true,gated:window.auto2Execute?.__tpfServerGate===true,originalSaved:typeof window.__tpfAuto2ExecuteLocal==='function'}));
  expect(serverMode).toEqual({flag:true,gated:true,originalSaved:true});
  await page.locator('#tpfFlowTrigger').selectOption('message_contains');
  await expect(page.locator('[data-trigger-key="keyword"]')).toBeVisible();
  await page.locator('[data-trigger-key="keyword"]').fill('renovación');
  await builder.locator('[data-add="action"]').click();
  await page.locator('#tpfStepEditor select[data-key="action_type"]').selectOption('create_opportunity');
  await expect(page.locator('#tpfStepEditor')).toContainText('Crear oportunidad');
  await expect(page.locator('#tpfStepEditor label').filter({hasText:'Título'}).first()).toBeVisible();
  await expect(page.locator('#tpfStepEditor label').filter({hasText:'Cliente'}).first()).toBeVisible();
  await expect(page.locator('#tpfStepEditor label').filter({hasText:'Teléfono'}).first()).toBeVisible();
  await expect(page.locator('#tpfStepEditor label').filter({hasText:'Importe'}).first()).toBeVisible();
  await expect(page.locator('#tpfStepEditor label').filter({hasText:'Columna / estado'}).first()).toBeVisible();
  await expect(page.locator('#tpfStepEditor label').filter({hasText:'Fecha prevista'}).first()).toBeVisible();
  await expect(page.locator('#tpfStepEditor label').filter({hasText:'Responsable'}).first()).toBeVisible();
  await expect(page.locator('#tpfStepEditor label').filter({hasText:'Notas'}).first()).toBeVisible();
  await builder.locator('[data-add="wait"]').click();
  await page.locator('#tpfStepEditor input[data-key="value"]').fill('5');
  await page.locator('#tpfStepEditor select[data-key="unit"]').selectOption('days');
  await builder.locator('[data-add="action"]').click();
  await page.locator('#tpfStepEditor select[data-key="action_type"]').selectOption('send_whatsapp_now');
  await expect(page.locator('#tpfStepEditor')).toContainText('Se envía en cuanto el flujo llega a este paso');
  await expect(page.locator('#tpfStepEditor textarea[data-cfg="text"]')).toBeVisible();
  await builder.locator('[data-add="repeat"]').click();
  await page.locator('#tpfStepEditor input[data-key="every_value"]').fill('3');
  await page.locator('#tpfStepEditor select[data-key="every_unit"]').selectOption('days');
  await page.locator('#tpfStepEditor input[data-key="times"]').fill('3');
  await page.locator('#tpfStepEditor input[data-key="stop_if_response"]').check();
  await expect(page.locator('#tpfFlowSteps .tpfFlowStep')).toHaveCount(4);
  await expect(page.locator('#tpfFlowSteps')).toContainText('Crear oportunidad');
  await expect(page.locator('#tpfFlowSteps')).toContainText('5 días');
  await expect(page.locator('#tpfFlowSteps')).toContainText('Enviar WhatsApp ahora');
  await expect(page.locator('#tpfFlowSteps')).toContainText('Cada 3 días');
  await page.screenshot({ path: 'test-results/automations-flow-builder.png', fullPage: true });
});

test('Sin errores JavaScript graves al iniciar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e.message || e)));
  await login(page);
  await page.waitForTimeout(2500);
  expect(errors, `Errores JS detectados:\n${errors.join('\n---\n')}`).toEqual([]);
});
