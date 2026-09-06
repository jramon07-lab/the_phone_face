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
  const selectors=[
    `#searchRows [onclick*="openContact('${recordId}')"]`,
    `#searchUnifiedRows [onclick*="openContact('${recordId}')"]`,
    `#searchGroupedResults [onclick*="openContact('${recordId}')"]`
  ].join(',');
  const direct=page.locator(selectors).first();
  try{await expect(direct).toBeVisible({timeout:15000});await direct.click();}
  catch(_){
    const row=page.locator('#searchRows tr, #searchUnifiedRows tr, #searchGroupedResults tr').filter({hasText:value}).first();
    await expect(row).toBeVisible({timeout:5000});
    const clickable=row.locator('[onclick*="openContact"],button,a').first();
    if(await clickable.count())await clickable.click();else await row.click();
  }
  await expect(page.locator('#contactModal')).toBeVisible({timeout:10000});
  await expect(page.locator('#contactModal .cpRefEdit')).toBeVisible({timeout:5000});
}

async function shot(page,name){
  const dir=path.join(process.cwd(),'browser-evidence','contact-profile');
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,`${name}.png`),fullPage:true});
}

test('cuenta demo por interfaz real: editor separado y oportunidades responden', async ({page})=>{
  await login(page);
  const linked=await page.evaluate(async()=>{await loadSales();const people=await TPFRecordLinks.load(sb);const found=people.find(c=>TPFRecordLinks.related(salesCache.opportunities,people,c.id,'opportunity').length>0);return {recordId:found?.id};});
  expect(linked.recordId,'Debe existir un contacto con oportunidades para comprobar este recorrido').toBeTruthy();
  await openRecordThroughUi(page,linked.recordId);

  await page.locator('#contactModal .cpRefEdit').click();
  await expect(page.locator('#tpfContactsCreateBack')).toBeVisible({timeout:5000});
  await expect(page.locator('#tpfCreateFirst')).toBeEditable();
  await expect(page.locator('#tpfCreateLast')).toBeEditable();
  await expect(page.locator('#tpfCreatePhone')).toBeEditable();
  await expect(page.locator('#tpfContactsCreateSave')).toBeVisible();
  await shot(page,'demo-ui-01-editor-separado');
  await page.locator('#tpfContactsCreateCancel').click();
  await expect(page.locator('#tpfContactsCreateBack')).toBeHidden({timeout:5000});

  await page.locator('#cpNewOpp').click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:5000});
  await shot(page,'demo-ui-02-nueva-oportunidad-abierta');
  await page.locator('#oppModalCloseX').click();
  await expect(page.locator('#oppDetailModal')).toBeHidden({timeout:5000});

  await page.locator('#contactClose').click();
  await expect(page.locator('#contactModal')).toBeHidden({timeout:5000});
  await openRecordThroughUi(page,linked.recordId);
  await expect(page.locator('#cpOpportunities')).not.toContainText('No hay oportunidades.',{timeout:10000});
  const label=page.locator('#cpOpportunities').getByText(/Ver\s*\/\s*editar/i).first();
  await expect(label).toBeVisible({timeout:10000});
  const card=label.locator('xpath=ancestor::*[@data-opp-id][1]');
  if(await card.count()) await card.click({position:{x:8,y:8}});
  else await label.locator('xpath=ancestor::*[not(self::button) and not(self::a)][1]').click({position:{x:8,y:8}});
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:5000});
  await shot(page,'demo-ui-03-ver-editar-oportunidad-abierta');
});
