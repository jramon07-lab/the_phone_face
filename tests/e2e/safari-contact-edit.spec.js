const { test, expect } = require('@playwright/test');

async function login(page){
  await page.goto('/', { waitUntil:'domcontentloaded' });
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
}

test('Safari/WebKit: Editar datos permite escribir y muestra Guardar cambios', async ({page})=>{
  await login(page);
  const id=await page.evaluate(async()=>{const {data}=await sb.from('records').select('id').limit(1);return data?.[0]?.id||null;});
  expect(id,'No hay contacto disponible para validar Safari').toBeTruthy();
  await page.evaluate(id=>{window.openContact(id);},id);
  await expect(page.locator('#contactModal')).toBeVisible({timeout:7000});
  await expect(page.locator('#tpfContactEditToggle')).toBeVisible({timeout:4000});
  await expect(page.locator('#contactPhone')).toHaveAttribute('readonly','');
  await page.locator('#tpfContactEditToggle').click();
  await expect(page.locator('#tpfContactEditToggle')).toHaveText('Cancelar edición');
  await expect(page.locator('#contactPhone')).not.toHaveAttribute('readonly','');
  await expect(page.locator('#contactDni')).not.toHaveAttribute('readonly','');
  await expect(page.locator('#contactNotes')).not.toHaveAttribute('readonly','');
  await expect(page.locator('#tpfContactSaveLocal')).toBeVisible();
  const original=await page.locator('#contactPhone').inputValue();
  const probe=(original||'600000000')+'9';
  await page.locator('#contactPhone').fill(probe);
  await expect(page.locator('#contactPhone')).toHaveValue(probe);
  await page.locator('#contactPhone').fill(original);
  await page.locator('#tpfContactEditToggle').click();
  await expect(page.locator('#tpfContactEditToggle')).toHaveText('Editar datos');
  await expect(page.locator('#contactPhone')).toHaveAttribute('readonly','');
});
