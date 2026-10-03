const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('Tramitado previews and edits without writes; cancellation saves nothing',async({page})=>{
 await page.setContent('<button id="start">Tramitado</button>');
 await page.evaluate(()=>{
  window.calls=[];window.sb={from(){return{select(){return this},async like(){return{data:[],error:null}}}},rpc:async(name,args)=>{calls.push({name,args});return {data:{available:true,text:'Hola Ana 👋\n\nCuando te instalen la fibra, avísanos. Si tienes algún problema, llámanos.\n\n⚠️ Activa Netflix cuando tu línea esté en Vodafone.\n\n📦 Las instrucciones para devolver el router anterior pueden tardar hasta 15 días.',operator:'Vodafone',rule_id:'11111111-1111-1111-1111-111111111111',recipient:'Ana',phone:'600000000'}}}};
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
 await page.locator('[data-mode]').selectOption('return');
 await expect(page.locator('[data-text]')).not.toHaveValue(/Cuando te instalen|Netflix/);
 await expect(page.locator('[data-text]')).toHaveValue(/Hola Ana[\s\S]*tienda Movistar/);
 await page.locator('[data-mode]').selectOption('full');
 await expect(page.locator('[data-text]')).toHaveValue(/Cuando te instalen[\s\S]*Netflix/);
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
  window.fixtureRecords=records;
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
 // With only the current contact available, both entry points skip the selector.
 await page.evaluate(()=>window.fixtureRecords.splice(1));
 for(const id of ['offer','direct']){
  await page.locator('#'+id).click();
  await expect.poll(()=>page.evaluate(()=>window.partyResult?.id)).toBe('manager');
  await expect(page.locator('dialog:has([data-holder])')).toHaveCount(0);
  expect(await page.evaluate(()=>window.partyResult.recipientId)).toBe('manager');
 }
});

test('Direct sale edits router inline and uses creation time with 00/30 minutes',async({page,context})=>{
 const fs=require('node:fs');await context.route('**/*',route=>route.abort());
 await page.setContent('<style>.hidden{display:none!important}</style><button id="open">Venta directa</button>');
 await page.clock.setFixedTime(new Date('2026-10-02T07:31:00Z'));
 await page.evaluate(()=>{
  window.calls=[];window.TPFModules={register(){}};window.currentContact={id:'fixture',data:{NOMBRE:'Ana'}};
  window.sb={from(){return{select(){return this},async like(){return{data:[],error:null}},eq(){return this},contains(){return this},async maybeSingle(){return{data:currentContact}},async limit(){return{data:[]}}}},rpc:async(name,args)=>{calls.push({name,args});if(name!=='crm_router_return_preview')throw Error('Writes are forbidden');return{data:{available:true,operator:'Vodafone',rule_id:'11111111-1111-1111-1111-111111111111',recipient:'Ana',phone:'600000000',text:'Hola Ana 👋\n\nCuando te instalen la fibra, avísanos. Si tienes algún problema, llámanos.\n\n📦 Las instrucciones antiguas del router.'}}}};
  window.confirm=()=>false;
 });
 await page.addScriptTag({path:path.resolve('js/modules/router-return.js')});
 await page.addScriptTag({content:fs.readFileSync('js/modules/offers-pro.js','utf8').replace("M.register('offers-pro',{install});","window.fixtureOpen=async()=>{css();await openDirectSale()};window.fixtureResult=()=>directRouter.get();")});
 await page.evaluate(()=>document.getElementById('open').onclick=window.fixtureOpen);
 await page.locator('#open').click();const root=page.locator('#directSaleRouterFields');
 await expect(root.locator('[data-previous]')).toBeVisible();
 await expect(root.locator('[data-text]')).not.toHaveValue(/instrucciones antiguas/);
 await root.locator('[data-previous]').selectOption('MásMóvil');
 await expect(root.locator('[data-text]')).toHaveValue(/código por SMS/);
 const layout=await root.locator('[data-text]').evaluate(el=>({width:el.getBoundingClientRect().width,parent:el.parentElement.getBoundingClientRect().width,display:getComputedStyle(el.parentElement).display}));expect(layout.display).toBe('block');expect(layout.width).toBeGreaterThan(layout.parent*.9);
 await root.locator('[data-mode]').selectOption('return');
 await expect(root.locator('[data-text]')).not.toHaveValue(/Cuando te instalen/);
 await expect(root.locator('[data-text]')).toHaveValue(/Hola Ana[\s\S]*SMS/);
 await root.locator('[data-mode]').selectOption('full');
 await expect(root.locator('[data-text]')).toHaveValue(/Cuando te instalen/);
 const auto=await page.evaluate(()=>window.fixtureResult());expect(auto.send_at).toBe('2026-10-03T08:00:00.000Z');
 // A different operator changes the router paragraph while preserving manual edits.
 await root.locator('[data-text]').fill('Hola Ana. Mi texto editado.\n\n📦 Código por SMS.');
 await root.locator('[data-previous]').selectOption('O2');
 await expect(root.locator('[data-text]')).toHaveValue(/Mi texto editado[\s\S]*tienda Movistar/);
 await root.locator('[data-timing]').selectOption('custom');
 await expect(root.locator('[data-minute] option')).toHaveText(['00','30']);
 await root.locator('[data-date]').fill('2026-10-05');await root.locator('[data-hour]').selectOption('11');await root.locator('[data-minute]').selectOption('30');
 expect(await page.evaluate(()=>window.fixtureResult().send_at)).toBe('2026-10-05T09:30:00.000Z');
 await page.locator('#directSalePrice').fill('32');await page.locator('#directSaleSubmit').click();
 await expect(page.locator('#tpfRouterDialog')).toHaveCount(0);
 expect(await page.evaluate(()=>window.calls.every(x=>x.name==='crm_router_return_preview'))).toBe(true);
 const positions=await root.locator('.tpfRouterCheck').evaluate(el=>{const a=el.querySelector('input').getBoundingClientRect(),b=el.querySelector('span').getBoundingClientRect();return{gap:b.left-a.right,delta:Math.abs(b.top-a.top)}});expect(positions.gap).toBeGreaterThanOrEqual(0);expect(positions.delta).toBeLessThan(25);
});


test('Shared operator text persists across customers and fresh sessions; failures keep the form open',async({page})=>{
 await page.setContent('<button id="start">Tramitado</button>');
 await page.evaluate(()=>{
  window.rows={};window.saved=[];window.failSave=false;window.customer='Ana';
  window.sb={from(table){if(table!=='app_settings')throw Error('Unexpected table');let pending;return{select(){return this},async like(){return{data:Object.values(rows),error:null}},upsert(row){pending=row;return this},async single(){if(failSave)return{error:{message:'Sin conexión'}};rows[pending.key]=pending;saved.push(pending);return{data:pending,error:null}}}},rpc:async()=>({data:{available:true,recipient:customer,text:'Hola '+customer+' 👋\n\nCuando te instalen la fibra, avísanos.',operator:'Vodafone'}})};
 });
 const source=path.resolve('js/modules/router-return.js');await page.addScriptTag({path:source});
 await page.evaluate(()=>document.getElementById('start').onclick=()=>{window.result='pending';TPFRouterReturn.choose({operator:'Vodafone'}).then(x=>window.result=x)});
 await page.locator('#start').click();
 for(const operator of ['Digi','Pepephone','Jazztel'])await expect(page.locator('[data-previous] option[value="'+operator+'"]')).toHaveCount(1);
 await page.locator('[data-previous]').selectOption('Digi');
 await page.locator('[data-template-panel] summary').click();
 await page.locator('[data-template]').fill('Contacta con el operador. Guarda el justificante.');
 await expect(page.locator('[data-text]')).toHaveValue(/Hola Ana[\s\S]*Guarda el justificante/);
 await page.getByRole('button',{name:'Confirmar y continuar'}).click();
 await expect.poll(()=>page.evaluate(()=>saved.length)).toBe(1);
 expect(await page.evaluate(()=>saved[0].value.text)).not.toContain('Ana');
 // Reload the module to model another PC with an empty in-memory cache.
 await page.evaluate(()=>window.customer='Luis');await page.addScriptTag({path:source});
 await page.locator('#start').click();await page.locator('[data-previous]').selectOption('Digi');
 await expect(page.locator('[data-text]')).toHaveValue(/Hola Luis[\s\S]*Guarda el justificante/);
 await expect(page.locator('[data-send]')).toBeChecked();
 await page.locator('[data-template-panel] summary').click();
 await page.locator('[data-new-operator]').fill('Operador Nuevo');await page.locator('[data-add-operator]').click();
 await page.locator('[data-template]').fill('Instrucciones reutilizables de este operador.');
 await page.evaluate(()=>window.failSave=true);
 await page.getByRole('button',{name:'Confirmar y continuar'}).click();
 await expect(page.locator('[data-error]')).toContainText('Sin conexión');await expect(page.locator('#tpfRouterDialog')).toBeVisible();
 await page.evaluate(()=>window.failSave=false);await page.getByRole('button',{name:'Confirmar y continuar'}).click();
 await expect.poll(()=>page.evaluate(()=>saved.length)).toBe(2);
 await page.addScriptTag({path:source});await page.locator('#start').click();await page.locator('[data-previous]').selectOption('Operador Nuevo');
 await expect(page.locator('[data-text]')).toHaveValue(/Hola Luis[\s\S]*Instrucciones reutilizables/);
 await page.locator('[data-template-panel] summary').click();await page.locator('[data-template]').fill('Borrador cancelado');
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();expect(await page.evaluate(()=>saved.length)).toBe(2);
});
