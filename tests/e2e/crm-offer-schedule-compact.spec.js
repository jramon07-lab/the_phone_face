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

test('ofertas: checks compactos y fecha-hora conjunta en saltos de 30 minutos',async({page})=>{
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
  const dateTime=page.locator('#opScheduledAt');
  await expect(dateTime).toBeVisible();
  await expect(dateTime).toHaveAttribute('step','1800');
  expect(await dateTime.inputValue()).toMatch(/:(00|30)$/);
  const stepMilliseconds=await dateTime.evaluate(input=>{const before=input.valueAsNumber;input.stepUp();return input.valueAsNumber-before});
  expect(stepMilliseconds).toBe(30*60*1000);
  const dir=path.join(process.cwd(),'browser-evidence','offer-schedule');
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,'combined-half-hour-picker.png'),fullPage:true});
  await page.locator('input[name="opMode"][value="accepted"]').check();
  const acceptedSend=page.locator('#opAcceptedSend');
  await expect(acceptedSend).toBeVisible();
  await expect(acceptedSend).toBeChecked();
  const acceptedMetrics=await acceptedSend.evaluate(input=>{const box=input.getBoundingClientRect(),label=input.closest('label'),style=getComputedStyle(label);return{width:box.width,height:box.height,justify:style.justifyContent}});
  expect(acceptedMetrics.width).toBeLessThanOrEqual(18);
  expect(acceptedMetrics.height).toBeLessThanOrEqual(18);
  expect(acceptedMetrics.justify).toBe('flex-start');
  await page.screenshot({path:path.join(dir,'accepted-message-small-check.png'),fullPage:true});
});
