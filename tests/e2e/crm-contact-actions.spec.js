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
  await page.locator('.nav[data-view="search"][data-sheet=""]').click();
  await expect(page.locator('#view-search')).toBeVisible({timeout:5000});
  await page.locator('#searchSheet').selectOption('');
  await page.locator('#searchText').fill(value);
  await page.locator('#searchBtn').click();
  const direct=page.locator([
    `#searchRows [onclick*="openContact('${recordId}')"]`,
    `#searchUnifiedRows [onclick*="openContact('${recordId}')"]`,
    `#searchGroupedResults [onclick*="openContact('${recordId}')"]`
  ].join(',')).first();
  try{await expect(direct).toBeVisible({timeout:15000});await direct.click();}
  catch(_){
    const row=page.locator('#searchRows tr, #searchUnifiedRows tr, #searchGroupedResults tr').filter({hasText:value}).first();
    await expect(row).toBeVisible({timeout:5000});
    const clickable=row.locator('[onclick*="openContact"],button,a').first();
    if(await clickable.count())await clickable.click();else await row.click();
  }
  await expect(page.locator('#contactModal')).toBeVisible({timeout:10000});
}

async function shot(page,name){
  const dir=path.join(process.cwd(),'browser-evidence','contact-profile');
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,`${name}.png`),fullPage:true});
}

test('ficha cliente usa propietarios nativos y tarea completa su ciclo', async ({page})=>{
  await login(page);
  const recordId='fe4b2188-8a08-445f-bbaa-6d4d5f89377d';
  await openRecordThroughUi(page,recordId);

  // Editor único: activa los campos reales de la ficha, sin modal paralelo.
  await expect(page.locator('#tpfContactEditToggle')).toBeVisible({timeout:5000});
  await page.locator('#tpfContactEditToggle').click();
  await expect(page.locator('#contactFirstName')).toBeEditable();
  await expect(page.locator('#contactPhone')).toBeEditable();
  await expect(page.locator('#tpfContactEditorBack')).toHaveCount(0);
  const firstName=await page.locator('#contactFirstName').inputValue();
  expect(firstName.trim().length).toBeGreaterThan(0);
  await page.locator('#tpfContactSaveLocal').click();
  await expect(page.locator('#contactMsg')).not.toContainText(/error|fall/i,{timeout:10000});
  await shot(page,'native-01-contacto-guardado');

  // Oportunidad nueva usa el modal nativo.
  await page.locator('#cpNewOpp').click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:5000});
  await expect(page.locator('#oppModalTitle')).toBeEditable();
  await page.locator('#oppModalCloseX').click();
  await expect(page.locator('#oppDetailModal')).toBeHidden({timeout:5000});

  // Oportunidad existente usa openOpportunityCard/editor nativo.
  await expect(page.locator('#cpOpportunities')).not.toContainText('No hay oportunidades.',{timeout:10000});
  const oppEdit=page.locator('#cpOpportunities').getByText(/Ver\s*\/\s*editar|Editar/i).first();
  await expect(oppEdit).toBeVisible({timeout:10000});
  await oppEdit.click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:5000});
  await expect(page.locator('#oppModalId')).not.toHaveValue('');
  await page.locator('#oppModalCloseX').click();

  // Nueva tarea es una pantalla propia dentro de la ficha, no Agenda.
  const taskTitle=`E2E ficha ${Date.now()}`;
  await page.locator('#cpSideNewTask').click();
  await expect(page.locator('#cpTaskPage')).toBeVisible({timeout:5000});
  await expect(page.locator('#view-agenda')).toBeHidden();
  await page.locator('#cpTaskTitle').fill(taskTitle);
  await page.locator('#cpTaskSave').click();
  await expect(page.locator('#cpTaskMsg')).toContainText('Tarea creada correctamente',{timeout:15000});
  await expect(page.locator('#cpTaskPage')).toBeHidden({timeout:5000});
  await expect(page.locator('#cpTasks')).toContainText(taskTitle,{timeout:10000});

  // Detalle es hermano de creación: puede abrirse aunque cpTaskPage esté oculto.
  const taskWrap=page.locator('#cpTasks .cpTaskWrap').filter({hasText:taskTitle}).first();
  await expect(taskWrap).toBeVisible({timeout:10000});
  await taskWrap.locator('button').first().click();
  await expect(page.locator('#cpTaskDetailPage')).toBeVisible({timeout:5000});
  await expect(page.locator('#cpTaskPage')).toBeHidden();
  await expect(page.locator('#cpTaskDetailTitle')).toHaveValue(taskTitle);
  expect(await page.locator('#cpTaskDetailPage').evaluate(el=>el.parentElement?.id)).not.toBe('cpTaskPage');

  // Guardar, completar, reabrir y eliminar usando el propietario nativo.
  await page.locator('#cpTaskDetailNotes').fill('Validación E2E ficha cliente');
  await page.locator('#cpTaskDetailSave').click();
  await expect(page.locator('#cpTaskDetailMsg')).toContainText('Cambios guardados',{timeout:10000});
  await page.locator('#cpTaskMarkDone').click();
  await expect(page.locator('#cpTaskDetailStatus')).toHaveText('Completada',{timeout:10000});
  await page.locator('#cpTaskReopen').click();
  await expect(page.locator('#cpTaskDetailStatus')).toHaveText('Pendiente',{timeout:10000});
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#cpTaskDelete').click();
  await expect(page.locator('#cpTaskDetailPage')).toBeHidden({timeout:10000});
  await expect(page.locator('#cpTasks')).not.toContainText(taskTitle,{timeout:10000});
  await shot(page,'native-02-tarea-ciclo-completo');
});
