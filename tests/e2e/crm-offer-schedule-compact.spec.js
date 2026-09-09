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

test('ofertas: checks compactos y fecha-hora conjunta con minutos 00/30',async({page})=>{
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
  await toggle.check();
  await expect(fields).toBeVisible();
  await expect(page.locator('.opDateTimeCombined')).toBeVisible();
  await expect(page.locator('#opSendOptions input[type="datetime-local"]')).toHaveCount(0);
  await expect(page.locator('#opScheduleDate')).toBeVisible();
  await expect(page.locator('#opScheduleHour option')).toHaveCount(24);
  const minutes=await page.locator('#opScheduleMinute option').evaluateAll(options=>options.map(option=>option.value));
  expect(minutes).toEqual(['00','30']);
  const dir=path.join(process.cwd(),'browser-evidence','offer-schedule');
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,'combined-half-hour-picker.png'),fullPage:true});
  const acceptedMode=page.locator('#opAcceptedMode');
  await expect(acceptedMode).toBeVisible();
  await expect(acceptedMode).not.toBeChecked();
  await acceptedMode.check();
  await expect(page.locator('#opSendOptions')).toBeHidden();
  const acceptedSend=page.locator('#opAcceptedSend');
  await expect(acceptedSend).toBeVisible();
  await expect(acceptedSend).toBeChecked();
  const acceptedMetrics=await acceptedSend.evaluate(input=>{const box=input.getBoundingClientRect(),label=input.closest('label'),style=getComputedStyle(label);return{width:box.width,height:box.height,justify:style.justifyContent}});
  expect(acceptedMetrics.width).toBeLessThanOrEqual(18);
  expect(acceptedMetrics.height).toBeLessThanOrEqual(18);
  expect(acceptedMetrics.justify).toBe('flex-start');
  await page.screenshot({path:path.join(dir,'accepted-message-small-check.png'),fullPage:true});
});
