const {test,expect}=require('@playwright/test');
const path=require('node:path');
async function fixture(page,status='accepted',realRouter=false){
 await page.setContent('<button id="origin">Gestionar</button><div id="view-dashboard" style="height:180px;overflow:auto"><div style="height:900px">Listado</div></div>');
 await page.evaluate(status=>{
  const o={id:'op',record_id:'record',pipeline_id:'pipe',stage_id:'pending',updated_at:'version',client_name:'Ana Ejemplo',phone:'600000000',contract_party:{holder_name:'Ana Ejemplo',holder_dni:'12345678Z',contact_dni:'12345678Z',recipient_name:'Ana',recipient_phone:'600000000'},after_sale_preferences:{previous_operator:'Orange'}};
  const x={id:'offer',opportunity_id:'op',contact_id:'record',status,operator:'Vodafone',offer_name:'Fibra y móvil',total_price:35,accepted_at:'2026-09-10T10:00:00Z'};
  window.__fixture={o,x,conflict:false,writes:0};
  window.sb={from(table){const q={async like(){return{data:[]}},select(){return q},eq(){return q},update(p){window.__fixture.writes++;q.payload=p;return q},single(){return Promise.resolve(q.payload?(window.__fixture.conflict?{error:{code:'PGRST116'}}:{data:{...o,...q.payload}}):{data:table==='crm_offer_instances'?x:o})},maybeSingle(){return Promise.resolve({data:{data:{APODO:'Anita'}}})},then(resolve){resolve({data:[{id:'processed',name:'Tramitado',pipeline_id:'pipe'}]})}};return q}};
  window.TPFOfferFollowup={state:{offers:[x]},htmlOffer(){return '<p>Seguimiento registrado</p>'},async load(){return this.state}};
  window.TPFControlWhatsappOffer=async()=>true;
  window.TPFRouterReturn={async preview(){return{available:true}},bind(root,data,opts){window.__fixture.send=opts.preferences.send;root.innerHTML='<label>Compañía anterior<select data-previous><option>Orange</option></select></label><label>Mensaje<textarea data-text>Hola Ana, avísanos cuando te instalen la fibra.</textarea></label><label><input type="checkbox" checked>Enviar al cliente</label>';return{get(){return{send:true,text:root.querySelector('textarea').value,previous_operator:'Orange'}},async saveTemplate(){}}}};
  window.sb.rpc=async(name,args)=>{window.__fixture.rpc={name,args};return{data:{available:true,text:'Hola Ana 👋\n\nCuando te instalen la fibra, avísanos.',recipient:'Ana',phone:'600000000',operator:'Vodafone'}}};
  window.openContact=()=>{};window.openOpportunityFull=()=>{};
  document.addEventListener('click',e=>{if(e.target.closest('[data-of-close]'))e.target.closest('dialog').close()});
 },status);
 await page.addScriptTag({path:path.resolve('js/modules/offer-work-plan.js')});
 if(realRouter)await page.addScriptTag({path:path.resolve('js/modules/router-return.js')});
 await page.addScriptTag({path:path.resolve('js/modules/home-manage-panel.js')});
 await page.locator('#origin').focus();await page.evaluate(()=>{document.getElementById('view-dashboard').scrollTop=300;window.TPFHomeManage.open('offer')});
 if(status==='accepted')await expect(page.locator('[data-confirm-processing]')).toBeEnabled({timeout:5000});
}
test('Gestionar shows identity, saved offer and checked send; closes preserving list',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await fixture(page);
 await expect(page.locator('.ofClientIdentity')).toContainText('Ana Ejemplo');await expect(page.locator('.ofClientIdentity')).toContainText('12345678Z');await expect(page.locator('.ofClientIdentity')).toContainText('600000000');await expect(page.locator('.ofClientIdentity')).toContainText('Orange');await expect(page.locator('[data-of-view]')).toHaveText('Ver oferta enviada');
 expect(await page.evaluate(()=>window.__fixture.send)).toBe(true);
 const box=await page.locator('#ofManageDialog').boundingBox();expect(box.x+box.width).toBeCloseTo(1280,0);expect(box.height).toBeCloseTo(800,0);
 await page.getByRole('button',{name:'Volver al listado'}).click();await expect(page.locator('dialog')).toHaveCount(0);expect(await page.locator('#view-dashboard').evaluate(el=>el.scrollTop)).toBe(300);await expect(page.locator('#origin')).toBeFocused();
});
test('conflict keeps reviewed message open and does not show false success',async({page})=>{
 await fixture(page);await page.evaluate(()=>window.__fixture.conflict=true);await page.locator('[data-text]').fill('Texto revisado');await page.locator('[data-confirm-processing]').click();await expect(page.locator('[data-process-error]')).toContainText('otro dispositivo');await expect(page.locator('[data-text]')).toHaveValue('Texto revisado');await expect(page.locator('dialog')).toBeVisible();
});
test('acceptance prepares tramitation without losing controls or leaving confirm disabled',async({page})=>{
 await fixture(page,'following');
 await page.getByRole('button',{name:'Marcar aceptada y preparar tramitación'}).click();await expect(page.locator('[data-confirm-processing]')).toBeEnabled();await page.locator('[data-confirm-processing]').click();await expect(page.locator('dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.__fixture.writes)).toBe(1);
});
test('mobile drawer fits the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);const box=await page.locator('dialog').boundingBox();expect(box.width).toBeLessThanOrEqual(390);expect(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});

test('real router controls validate the previous operator and preserve the edited message',async({page})=>{
 await fixture(page,'accepted',true);await expect(page.locator('[data-send]')).toBeChecked();await expect(page.locator('[data-previous]')).toHaveValue('Orange');await page.locator('[data-text]').fill('Hola Ana. Texto revisado para tu instalación.');await page.locator('[data-confirm-processing]').click();await expect(page.locator('dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.__fixture.writes)).toBe(1);
});
test('pausing opens the existing reason and Agenda review form',async({page})=>{
 await fixture(page,'following');await page.getByRole('button',{name:'Pausar seguimiento',exact:true}).click();await expect(page.locator('.ofPlanForm')).toBeVisible();await expect(page.locator('[name=reason]')).toBeVisible();await page.locator('[name=reason]').fill('Cliente pendiente de decidir');await page.getByRole('button',{name:'Guardar pausa',exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.__fixture.rpc.name)).toBe('crm_save_offer_work_plan');expect(await page.evaluate(()=>window.__fixture.rpc.args.p_pause)).toBe(true);
});
