const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const installation=fs.readFileSync('js/modules/installation-communications.js','utf8');
const resume=fs.readFileSync('js/modules/offer-resume.js','utf8');
for(const width of [1440,390]){
test.describe('Confirmed communications '+width,()=>{
 test.use({viewport:{width,height:844}});
 test.beforeEach(async({page})=>{await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<html><body><div id="editor"></div></body></html>'}));await page.goto('http://fixture.invalid');});
 test('three processing modes preserve recipient and require router operator',async({page})=>{
  await page.evaluate(()=>window.TPFRouterReturn={paragraphs:{Yoigo:'Devuelve el router de Yoigo en Correos.',Ninguno:''}});await page.addScriptTag({content:installation});
  await page.evaluate(()=>window.controller=TPFInstallations.bind(document.getElementById('editor'),{available:true,recipient:'Gestora',phone:'34600000001',operator:'Vodafone',contract_party:{holder_name:'Titular',holder_record_id:'holder',recipient_contact_id:'manager'},installation_config:{no_appointment_text:'Hola {nombre}, contrato con {operador}.'}},{}));
  const root=page.locator('#editor');await expect(root.locator('[data-previous]')).toBeVisible();await expect(root.locator('[data-send]')).toBeChecked();
  await root.locator('[data-communication-mode]').selectOption('return');await expect(root.locator('[data-appointment-editor]')).toBeHidden();await expect(root.locator('[data-return-text]')).toBeVisible();
  expect(await page.evaluate(()=>{try{controller.get();return ''}catch(e){return e.message}})).toContain('operador anterior');
  await root.locator('[data-previous]').selectOption('Yoigo');let result=await page.evaluate(()=>controller.get());expect(result.communication_mode).toBe('return');expect(result.send).toBe(false);expect(result.return_text).toContain('Yoigo');
  await root.locator('[data-communication-mode]').selectOption('none');result=await page.evaluate(()=>controller.get());expect(result.send).toBe(false);expect(result.communication_mode).toBe('none');
  await root.locator('[data-communication-mode]').selectOption('notice');result=await page.evaluate(()=>controller.get());expect(result.send).toBe(true);expect(result.text).toContain('Sobre el contrato de Titular.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 test('resume previews choices, cancel does not save, errors preserve selection',async({page})=>{
  await page.evaluate(()=>{window.calls=[];window.fail=false;window.sb={from(){return {select(){return this},eq(){return this},async single(){return {data:{id:'offer',status:'paused',updated_at:'v1'}}}}},async rpc(name,args){calls.push({name,args});if(name==='crm_offer_resume_preview')return {data:{send_at:'2030-06-03T10:30:00Z'}};return fail?{error:{message:'Cambió en otro equipo'}}:{data:{ok:true}};}};});await page.addScriptTag({content:resume});
  await page.evaluate(()=>void TPFOfferResume.choose('offer'));let d=page.locator('#tpfResumeOffer');await expect(d.locator('[data-save]')).toBeEnabled();await d.locator('[data-cancel]').click();await expect(d).toHaveCount(0);expect(await page.evaluate(()=>calls.filter(c=>c.name==='crm_resume_offer_at').length)).toBe(0);
  await page.evaluate(()=>void TPFOfferResume.choose('offer'));d=page.locator('#tpfResumeOffer');await d.locator('[name="mode"][value="custom"]').check();await d.locator('[name="at"]').fill('2030-06-03T12:30');await expect(d.locator('[data-save]')).toBeEnabled();await expect(d.locator('[data-preview]')).toContainText('Próximo WhatsApp');await page.evaluate(()=>fail=true);await d.locator('[data-save]').click();await expect(d.locator('[data-error]')).toContainText('otro equipo');await expect(d.locator('[name="at"]')).toHaveValue('2030-06-03T12:30');await expect(d.locator('[data-save]')).toBeEnabled();await page.evaluate(()=>fail=false);await d.locator('[data-save]').click();await expect(d).toHaveCount(0);
  const call=await page.evaluate(()=>calls.filter(c=>c.name==='crm_resume_offer_at').at(-1));expect(call.args).toEqual({p_offer_id:'offer',p_mode:'custom',p_local_at:'2030-06-03T12:30',p_expected_at:'v1'});
 });
});}
