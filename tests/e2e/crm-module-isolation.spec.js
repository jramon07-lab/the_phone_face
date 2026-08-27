const { test, expect } = require('@playwright/test');

async function login(page){
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

async function moduleState(page,name){return page.evaluate(n => window.TPFModules?.status().find(x => x.name === n) || null, name);}
async function expectModuleReady(page,name){const state=await moduleState(page,name);expect(state, `Módulo ${name} no registrado`).not.toBeNull();expect(['ready','ok'], `Módulo ${name} en estado ${state?.state}`).toContain(state.state);}

test('estructura física: cada dominio carga desde su archivo y el index no usa app-core', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const structure=await page.evaluate(() => ({scripts:[...document.scripts].map(s=>s.getAttribute('src')||'').filter(Boolean),styles:[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.getAttribute('href')||'')}));
  for(const src of ['/js/modules/contacts-sales-core.js','/js/modules/contact-profile.js','/js/modules/whatsapp-scheduling-core.js','/js/modules/whatsapp-green-core.js','/js/modules/agenda-core.js','/js/modules/automations-core.js','/js/modules/system-status-core.js'])expect(structure.scripts).toContain(src);
  expect(structure.scripts.some(x=>x.includes('/js/app-core.js'))).toBe(false);expect(structure.styles).toContain('/assets/app.css');
});

test('runtime: un fallo aislado no rompe el CRM', async ({ page }) => {
  await login(page);
  const result=await page.evaluate(()=>{const modules=window.TPFModules;if(!modules)return{runtime:false};modules.clearErrors();const guarded=modules.guard('isolation-test',()=>{throw new Error('fallo-controlado')});guarded();return{runtime:true,appVisible:!document.getElementById('app')?.classList.contains('hidden'),isolated:modules.status().find(x=>x.name==='isolation-test')?.state==='error',hasError:modules.errors().some(x=>x.module==='isolation-test')}});
  expect(result.runtime).toBe(true);expect(result.appVisible).toBe(true);expect(result.isolated).toBe(true);expect(result.hasError).toBe(true);await page.locator('.nav[data-view="sales"]').click();await expect(page.locator('#view-sales')).toBeVisible();
});

test('módulo WhatsApp: está aislado y su vista abre',async({page})=>{await login(page);await expectModuleReady(page,'whatsapp');const nav=page.locator('.nav[data-view="whatsapplive"]');if(await nav.count()){await nav.click();await expect(page.locator('#view-whatsapplive')).toBeVisible();}});
test('módulo Agenda: está aislado y su vista abre',async({page})=>{await login(page);await expectModuleReady(page,'agenda');const nav=page.locator('.nav[data-view="agenda"]');if(await nav.isVisible()){await nav.click();await expect(page.locator('#view-agenda')).toBeVisible();}});
test('módulo Contactos/Ventas: está aislado y Ventas abre',async({page})=>{await login(page);await expectModuleReady(page,'contacts-sales');const nav=page.locator('.nav[data-view="sales"]');await expect(nav).toBeVisible();await nav.click();await expect(page.locator('#view-sales')).toBeVisible();});

test('módulo Ficha de contacto: edición real, guardado local, observaciones, etiquetas y WhatsApp interno', async ({ page }) => {
  await login(page);await expectModuleReady(page,'contact-profile');
  const id=await page.evaluate(async()=>{const {data}=await sb.from('records').select('id').limit(1);return data?.[0]?.id||null});
  expect(id,'No hay contacto de prueba disponible').toBeTruthy();
  await page.evaluate(id=>{window.__tpfOpenStart=performance.now();window.openContact(id);},id);
  await expect(page.locator('#contactModal')).toBeVisible({timeout:5000});
  const visibleMs=await page.evaluate(()=>performance.now()-window.__tpfOpenStart);expect(visibleMs,'La ficha tarda demasiado en hacerse visible').toBeLessThan(3500);
  await expect(page.locator('#tpfContactEditToggle')).toBeVisible({timeout:3000});
  await expect(page.locator('#contactPhone')).toHaveAttribute('readonly','');
  await expect(page.locator('#contactObservations')).toHaveAttribute('readonly','');
  await expect(page.locator('#tpfContactSaveLocal')).toBeHidden();
  await page.locator('#tpfContactEditToggle').click();
  await expect(page.locator('#tpfContactEditToggle')).toHaveText('Cancelar edición');
  await expect(page.locator('#contactPhone')).not.toHaveAttribute('readonly','');
  await expect(page.locator('#contactObservations')).not.toHaveAttribute('readonly','');
  await expect(page.locator('#tpfContactSaveLocal')).toBeVisible();
  await page.locator('#contactManageLabels').click();await expect(page.locator('#contactLabelsModal')).toBeVisible();await expect(page.locator('#contactLabelsSearch')).toBeVisible();await page.locator('#contactLabelsClose').click();
  await expect(page.locator('#tpfContactWhatsappMain')).toBeVisible();
  await page.evaluate(()=>{const p=document.getElementById('contactPhone');if(p)p.value='600000000';window.__tpfExternalOpen=0;window.open=()=>{window.__tpfExternalOpen++;};});
  await page.locator('#tpfContactWhatsappMain').click();
  await expect(page.locator('#waQuickModal')).toBeVisible();await expect(page.locator('#tpfQuickTemplateBtn')).toBeVisible();await expect(page.locator('#waQuickDrop')).toBeVisible();
  const externalOpen=await page.evaluate(()=>window.__tpfExternalOpen);expect(externalOpen).toBe(0);
});

test('navegación principal responde sin bloqueos largos', async ({ page }) => {
  await login(page);const routes=[['sales','#view-sales'],['database','#view-database'],['agenda','#view-agenda'],['whatsapplive','#view-whatsapplive'],['automations','#view-automations']];
  for(const [view,target] of routes){const nav=page.locator(`.nav[data-view="${view}"]`).first();if(!(await nav.count())||!(await nav.isVisible()))continue;const start=Date.now();await nav.click();await expect(page.locator(target)).toBeVisible({timeout:2500});expect(Date.now()-start,`${view} tarda demasiado en responder`).toBeLessThan(2500);}
});

test('módulo Automatizaciones/Ajustes: está aislado y constructor libre abre',async({page})=>{await login(page);await expectModuleReady(page,'automations-settings');const nav=page.locator('.nav[data-view="automations"]');if(await nav.isVisible()){await nav.click();await expect(page.locator('#view-automations')).toBeVisible();await expect(page.locator('#tpfFlowBuilder')).toBeVisible();await expect(page.locator('#tpfFlowBuilder')).toContainText('Constructor libre de automatizaciones');}});

test('módulo Estado del sistema: respeta permisos y muestra módulos al admin', async ({ page }) => {
  await login(page);await expectModuleReady(page,'system-status');const isAdmin=await page.evaluate(()=>{try{return typeof perms!=='undefined'&&!!perms?.is_admin}catch(_){return false}});const nav=page.locator('.nav[data-view="system"]');if(isAdmin){await expect(nav).toBeVisible();await nav.click();await expect(page.locator('#view-system')).toBeVisible();await expect(page.locator('#tpfModuleStatusCard')).toBeVisible({timeout:10000});}else{await expect(nav).toBeHidden();}
});
