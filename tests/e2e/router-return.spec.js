const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('Tramitado previews and edits without writes; cancellation saves nothing',async({page})=>{
 await page.setContent('<button id="start">Tramitado</button>');
 await page.evaluate(()=>{
  window.calls=[];window.sb={rpc:async(name,args)=>{calls.push({name,args});return {data:{available:true,text:'Hola Ana 👋\n\nCuando te instalen la fibra, avísanos. Si tienes algún problema, llámanos.\n\n⚠️ Activa Netflix cuando tu línea esté en Vodafone.\n\n📦 Las instrucciones para devolver el router anterior pueden tardar hasta 15 días.',operator:'Vodafone',rule_id:'11111111-1111-1111-1111-111111111111',recipient:'Ana',phone:'600000000'}}}};
 });
 await page.addScriptTag({path:path.resolve('js/modules/router-return.js')});
 await page.evaluate(()=>document.getElementById('start').onclick=()=>{window.result='pending';window.TPFRouterReturn.choose({contactId:'fixture',operator:'Vodafone'}).then(x=>window.result=x);});
 await page.getByRole('button',{name:'Tramitado',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar y continuar'}).click();
 await expect(page.locator('[data-error]')).toContainText('Selecciona');
 await page.locator('[data-previous]').selectOption('Yoigo');
 await expect(page.locator('[data-text]')).toHaveValue(/SMS/);
 await expect(page.locator('[data-text]')).toHaveValue(/Netflix/);
 await page.locator('[data-previous]').selectOption('O2');
 await expect(page.locator('[data-text]')).toHaveValue(/tienda Movistar/);
 await page.locator('[data-text]').fill('Hola Ana. Texto editado para tu devolución.');
 await page.getByRole('button',{name:'Confirmar y continuar'}).click();
 await expect.poll(()=>page.evaluate(()=>window.result?.text)).toBe('Hola Ana. Texto editado para tu devolución.');
 expect(await page.evaluate(()=>window.result.previous_operator)).toBe('O2');
 expect(await page.evaluate(()=>window.calls.every(x=>x.name==='crm_router_return_preview'))).toBe(true);
 await page.getByRole('button',{name:'Tramitado',exact:true}).click();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.result)).toBe(null);
 await page.getByRole('button',{name:'Tramitado',exact:true}).click();
 await page.locator('[data-send]').uncheck();
 await page.getByRole('button',{name:'Confirmar y continuar'}).click();
 await expect.poll(()=>page.evaluate(()=>window.result?.send)).toBe(false);
});

test('Offer and direct sale party preview survives unavailable linked contacts',async({page,context})=>{
 const fs=require('node:fs');await context.route('**/*',route=>route.abort());
 await page.setContent('<button id="offer">Enviar oferta</button><button id="direct">Venta directa</button>');
 await page.evaluate(()=>{
  window.reads=[];window.TPFModules={register(){}};
  const records=[{id:'manager',data:{NOMBRE:'Gestor',TPF_RELACIONES:{managed_contacts:[{record_id:'gone'},{record_id:'owner'},{record_id:'gone'}]}}},{id:'owner',data:{NOMBRE:'Titular'}}];
  window.sb={from(table){if(table!=='records')throw Error('Unexpected table');let id;return{select(){return this},eq(key,value){if(key==='id')id=value;return this},contains(key,value){id=value.TPF_RELACIONES.managed_contacts[0].record_id;return this},async maybeSingle(){reads.push(id);return{data:records.find(x=>x.id===id)||null,error:null}},async limit(){return{data:records.filter(x=>x.data.TPF_RELACIONES?.managed_contacts.some(y=>y.record_id===id))}}}}};
 });
 const source=fs.readFileSync('js/modules/offers-pro.js','utf8').replace("M.register('offers-pro',{install});","window.previewParty=directOfferContext;");
 await page.addScriptTag({content:source});
 await page.evaluate(()=>{for(const id of ['offer','direct'])document.getElementById(id).onclick=()=>{window.partyResult=null;window.previewParty({id:'manager'}).then(x=>window.partyResult=x)}});
 for(const id of ['offer','direct']){
  await page.locator('#'+id).click();const dialog=page.locator('dialog:has([data-holder])');
  await expect(dialog.locator('[data-unavailable-contacts]')).toContainText('ya no están disponibles');
  await expect(dialog.locator('[data-holder] option')).toHaveCount(3);
  await dialog.locator('[data-holder]').selectOption('1');
  await expect(dialog.locator('[data-manager]')).toHaveValue('manager');
  await dialog.locator('[data-continue]').click();
  await expect.poll(()=>page.evaluate(()=>window.partyResult?.id)).toBe('owner');
  expect(await page.evaluate(()=>window.partyResult.managerId)).toBe('manager');
  expect(await page.evaluate(()=>window.partyResult.recipientId)).toBe('manager');
 }
 expect(await page.evaluate(()=>window.reads.filter(x=>x==='gone').length)).toBe(2);
});
