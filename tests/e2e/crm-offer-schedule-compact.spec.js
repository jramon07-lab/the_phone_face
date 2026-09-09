const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');

async function login(page){
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
}

test('ofertas: programación compacta usa un check y franjas exactas de 30 minutos',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await login(page);
  const contactId=await page.evaluate(async()=>{
    const {data,error}=await sb.from('records').select('id,data').limit(1000);
    if(error)throw error;
    return data?.find(row=>String(row.data?.['TELÉFONO']||row.data?.['TELÉFONO 1']||'').replace(/\D/g,'').endsWith('695661409'))?.id||null;
  });
  expect(contactId,'Debe existir el contacto autorizado terminado en 409').toBeTruthy();
  await page.evaluate(id=>window.openContact(id),contactId);
  await expect(page.locator('#contactModal')).toBeVisible();
  await page.locator('#cpNewOffer').click();
  await expect(page.locator('#opOfferModal')).toBeVisible();
  const toggle=page.locator('#opScheduleToggle'),fields=page.locator('#opScheduleFields');
  await expect(toggle).toBeVisible({timeout:15000});
  await expect(toggle).not.toBeChecked();
  await expect(fields).toBeHidden();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
  await toggle.check();
  await expect(fields).toBeVisible();
  await expect(page.locator('#opScheduleDate')).toBeVisible();
  const slots=await page.locator('#opScheduleTime option').evaluateAll(options=>options.map(option=>option.value));
  expect(slots).toHaveLength(48);
  expect(slots[0]).toBe('00:00');
  expect(slots[1]).toBe('00:30');
  expect(slots.at(-1)).toBe('23:30');
  expect(slots.every(value=>/:00$|:30$/.test(value))).toBeTruthy();
  const dir=path.join(process.cwd(),'browser-evidence','offer-schedule');
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,'compact-half-hour-picker.png'),fullPage:true});
});
