const { test, expect } = require('@playwright/test');

async function login(page){
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

async function openRecord(page,id){
  await page.evaluate(recordId=>window.openContact(recordId),id);
  await expect(page.locator('#contactModal')).toBeVisible({timeout:5000});
  await expect(page.locator('#tpfContactEditToggle')).toBeVisible({timeout:5000});
}

async function shot(page,name){
  await page.screenshot({path:`test-results/${name}.png`,fullPage:true});
}

test('cuenta demo: Editar datos, crear oportunidad y ver/editar oportunidad responden', async ({page})=>{
  await login(page);
  const ids=await page.evaluate(async()=>{
    const {data,error}=await sb.from('records').select('id').limit(30);
    if(error)throw error;
    return (data||[]).map(x=>x.id);
  });
  expect(ids.length,'No hay contactos disponibles para validar la ficha').toBeGreaterThan(0);

  await openRecord(page,ids[0]);

  await expect(page.locator('#tpfContactEditToggle')).toHaveText('Editar datos');
  await expect(page.locator('#contactPhone')).toHaveAttribute('readonly','');
  await page.locator('#tpfContactEditToggle').click();
  await expect(page.locator('#tpfContactEditToggle')).toHaveText('Cancelar edición');
  await expect(page.locator('#contactPhone')).not.toHaveAttribute('readonly','');
  await expect(page.locator('#tpfContactSaveLocal')).toBeVisible();
  await shot(page,'demo-01-editar-datos-activo');
  await page.locator('#tpfContactEditToggle').click();
  await expect(page.locator('#tpfContactEditToggle')).toHaveText('Editar datos');

  await page.locator('#cpNewOpp').click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:5000});
  await shot(page,'demo-02-nueva-oportunidad-abierta');
  await page.evaluate(()=>document.getElementById('oppDetailModal')?.classList.add('hidden'));

  let foundExisting=false;
  for(const id of ids){
    await page.evaluate(recordId=>window.openContact(recordId),id);
    await expect(page.locator('#contactModal')).toBeVisible({timeout:5000});
    await page.waitForTimeout(350);
    const openButtons=page.locator('#cpOpportunities button').filter({hasText:/ver|editar/i});
    if(await openButtons.count()){
      const first=openButtons.first();
      if(await first.isVisible()){
        foundExisting=true;
        await first.click();
        await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:5000});
        await shot(page,'demo-03-ver-editar-oportunidad-abierta');
        break;
      }
    }
  }
  expect(foundExisting,'No se encontró ninguna oportunidad existente accesible desde una ficha demo').toBe(true);
});