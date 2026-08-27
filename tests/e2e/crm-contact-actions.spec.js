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

  // Caso real previamente verificado en Supabase para evitar falsos negativos de búsqueda desde el navegador.
  const linked={
    recordId:'fe4b2188-8a08-445f-bbaa-6d4d5f89377d',
    opportunityId:'f1e68355-6df7-4a94-a62f-06c95daaf0ba'
  };

  await openRecord(page,linked.recordId);

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

  await openRecord(page,linked.recordId);
  await expect(page.locator('#cpOpportunities')).not.toContainText('No hay oportunidades.',{timeout:5000});
  const existing=page.locator(`#cpOpportunities [onclick*="${linked.opportunityId}"], #cpOpportunities [data-opp-id="${linked.opportunityId}"]`).first();
  await expect(existing).toBeVisible({timeout:5000});
  await existing.click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:5000});
  await shot(page,'demo-03-ver-editar-oportunidad-abierta');
});
