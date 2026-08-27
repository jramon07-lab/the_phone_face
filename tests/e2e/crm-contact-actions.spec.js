const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function login(page){
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

async function getSearchValue(page,recordId){
  return await page.evaluate(async id=>{
    const {data,error}=await sb.from('records').select('data').eq('id',id).single();
    if(error||!data)throw new Error(error?.message||'Contacto demo no encontrado');
    const d=data.data||{};
    const phone=String(d['TELÉFONO']||d['TELEFONO']||d['PHONE']||d['MOVIL']||'').trim();
    const name=String(d['NOMBRE Y APELLIDOS']||d['NOMBRE']||d['CLIENTE']||d['CLIENTE FINAL']||'').trim();
    return phone||name;
  },recordId);
}

async function openRecordThroughUi(page,recordId){
  const value=await getSearchValue(page,recordId);
  if(!value)throw new Error('El contacto demo no tiene un valor buscable');

  await page.locator('.nav[data-view="search"][data-sheet=""]').click();
  await expect(page.locator('#view-search')).toBeVisible({timeout:5000});
  await page.locator('#searchSheet').selectOption('');
  await page.locator('#searchText').fill(value);
  await page.locator('#searchBtn').click();

  const containers=['#searchRows','#searchUnifiedRows','#searchGroupedResults'];
  let opened=false;
  for(const selector of containers){
    const host=page.locator(selector);
    if(!(await host.count()))continue;
    const direct=host.locator(`[onclick*="openContact('${recordId}')"], [onclick*='openContact("${recordId}")'], [data-record-id="${recordId}"]`).first();
    if(await direct.count()){
      await expect(direct).toBeVisible({timeout:5000});
      await direct.click();
      opened=true;
      break;
    }
    const row=host.locator('tr').filter({hasText:value}).first();
    if(await row.count()){
      const clickable=row.locator('[onclick*="openContact"],button,a').first();
      if(await clickable.count())await clickable.click();else await row.click();
      opened=true;
      break;
    }
  }
  if(!opened)throw new Error('El contacto no aparece como elemento pulsable en la búsqueda visible');
  await expect(page.locator('#contactModal')).toBeVisible({timeout:7000});
  await expect(page.locator('#tpfContactEditToggle')).toBeVisible({timeout:5000});
}

async function shot(page,name){
  const dir=path.join(process.cwd(),'browser-evidence','contact-profile');
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,`${name}.png`),fullPage:true});
}

test('cuenta demo por interfaz real: Editar datos, crear oportunidad y ver/editar oportunidad responden', async ({page})=>{
  await login(page);

  const linked={
    recordId:'fe4b2188-8a08-445f-bbaa-6d4d5f89377d',
    opportunityId:'f1e68355-6df7-4a94-a62f-06c95daaf0ba'
  };

  await openRecordThroughUi(page,linked.recordId);

  await expect(page.locator('#tpfContactEditToggle')).toHaveText('Editar datos');
  await expect(page.locator('#contactPhone')).toHaveAttribute('readonly','');
  await page.locator('#tpfContactEditToggle').click();
  await expect(page.locator('#tpfContactEditToggle')).toHaveText('Cancelar edición');
  await expect(page.locator('#contactPhone')).not.toHaveAttribute('readonly','');
  await expect(page.locator('#tpfContactSaveLocal')).toBeVisible();
  await shot(page,'demo-ui-01-editar-datos-activo');
  await page.locator('#tpfContactEditToggle').click();

  await page.locator('#cpNewOpp').click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:5000});
  await shot(page,'demo-ui-02-nueva-oportunidad-abierta');
  await page.locator('#oppModalCloseX').click();
  await expect(page.locator('#oppDetailModal')).toBeHidden({timeout:5000});

  await page.locator('#contactClose').click();
  await expect(page.locator('#contactModal')).toBeHidden({timeout:5000});
  await openRecordThroughUi(page,linked.recordId);

  await expect(page.locator('#cpOpportunities')).not.toContainText('No hay oportunidades.',{timeout:5000});
  const existing=page.locator(`#cpOpportunities [onclick*="${linked.opportunityId}"], #cpOpportunities [data-opp-id="${linked.opportunityId}"]`).first();
  await expect(existing).toBeVisible({timeout:5000});
  await existing.click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:5000});
  await shot(page,'demo-ui-03-ver-editar-oportunidad-abierta');
});
