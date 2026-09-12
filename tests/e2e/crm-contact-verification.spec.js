const {test,expect}=require('@playwright/test');

test('Identidad: apodo aislado y verificación reutilizada sin consultas a Google',async({page,request})=>{
  const response=await request.get('/js/modules/contact-google-inline.js?v=20260912-verified-dropdown-1');
  expect(response.ok()).toBeTruthy();const source=await response.text();
  await page.route('**/__contact-identity-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head></head><body><div id="view-whatsapplive"><div id="waLiveChats"><div class="waChatRow active"><div class="waChatRowMain"><div class="waChatRowTop"><b>Inicial</b></div></div></div></div><div id="waChatName">Inicial</div><small id="waChatNickname"></small><div id="waSideName">Inicial</div><small id="waSideNickname"></small><div id="waContactCard"><div id="waContactState"></div></div></div></body></html>`}));
  await page.goto('/__contact-identity-fixture');
  await page.evaluate(()=>{
    window.googleReads=0;window.googleContactsConnected=()=>true;window.googleContactsEmail=()=> 'shop@example.test';
    window.googleApi=async()=>{window.googleReads++;throw Error('No debe consultar Google')};
    const chat={id:'34900000001@c.us',name:'Nombre antiguo'};
    const row={id:'fixture-a',data:{NOMBRE:'Nombre',APELLIDOS:'Correcto',APODO:'Alias sólo A','TELÉFONO':'900000001',TPF_WHATSAPP_CHAT_ID:chat.id,TPF_WHATSAPP_NAME_CONFIRMED:{chat_id:chat.id}}};
    row.data.TPF_CONTACT_VERIFIED={version:1,signature:JSON.stringify([row.id,'900000001','Nombre','Correcto','Alias sólo A']),chat_id:chat.id,google_account:'shop@example.test',google_resource:'people/fixture-a',verified_at:'2026-09-12T00:00:00Z'};
    window.fixtureA={chat,row};window.waLiveState={selected:chat,contact:row,selectionVersion:1};
    window.TPFModules={register(_name,module){module.install()}};
  });
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.TPFContactGoogleInline.refreshWhatsapp());
  await expect(page.locator('#tpfWaAliasCard')).toContainText('Contacto verificado');
  const details=page.locator('#tpfWaAliasCard details');
  await expect(details).not.toHaveAttribute('open','');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open','');
  await expect(page.locator('#waSideNickname')).toHaveText('Alias sólo A');
  await page.evaluate(async()=>{for(let i=0;i<10;i++)await window.TPFContactGoogleInline.refreshWhatsapp()});
  expect(await page.evaluate(()=>window.googleReads)).toBe(0);
  await expect(details).toHaveAttribute('open','');
  await page.evaluate(async()=>{
    window.dispatchEvent(new Event('tpf:wa-chat-changing'));
    const chat={id:'34900000002@c.us',name:'Contacto B'};
    window.waLiveState.selected=chat;window.waLiveState.selectionVersion++;
    window.waLiveState.contact={id:'fixture-b',data:{NOMBRE:'Contacto',APELLIDOS:'B','TELÉFONO':'900000002',TPF_WHATSAPP_CHAT_ID:chat.id}};
    document.getElementById('waChatName').textContent='Contacto B';document.getElementById('waSideName').textContent='Contacto B';
    await window.TPFContactGoogleInline.refreshWhatsapp({checkGoogle:false});
  });
  await expect(page.locator('#waChatNickname')).toHaveText('');await expect(page.locator('#waSideNickname')).toHaveText('');
  await expect(page.locator('#waSideName')).toHaveText('Contacto B');
  await page.evaluate(async()=>{window.waLiveState.selected=window.fixtureA.chat;window.waLiveState.contact=window.fixtureA.row;window.waLiveState.selectionVersion++;await window.TPFContactGoogleInline.refreshWhatsapp()});
  await expect(page.locator('#waSideNickname')).toHaveText('Alias sólo A');await expect(page.locator('#tpfWaAliasCard')).toContainText('Contacto verificado');
  expect(await page.evaluate(()=>window.googleReads)).toBe(0);
});

test('Verificación anterior: guarda solo el estado y lo comparte con WhatsApp',async({page,request})=>{
 const response=await request.get('/js/modules/contact-google-inline.js?v=20260912-verified-dropdown-1');expect(response.ok()).toBeTruthy();
 const source=(await response.text()).replace("M.register('contact-google-inline',{install});","window.testApi={persistMatchingVerification,renderVerifiedCard,savedVerification};");
 await page.route('**/__verified-migration',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div id="profile"></div><div id="whatsapp"></div>'}));await page.goto('/__verified-migration');
 await page.evaluate(()=>{
  window.googleContactsEmail=()=> 'shop@example.test';window.TPFModules={register(){}};window.writeCount=0;
  const chat={id:'34900000001@c.us',name:'Anterior'};
  const row={id:'fixture',data:{NOMBRE:'Nombre',APELLIDOS:'Apellido',APODO:'Alias','TELÉFONO':'900000001',DNI:'Conservar',TPF_WHATSAPP_NAME_CONFIRMED:{chat_id:chat.id}}};
  window.currentContact=row;window.waLiveState={selected:chat,contact:structuredClone(row)};window.before=JSON.stringify(row.data);
  window.sb={from(){let data;return{update(payload){data=payload.data;return this},eq(key,value){if(key==='data'&&value!==window.before)throw Error('Missing concurrency guard');return this},select(){return this},async single(){window.writeCount++;return{data:{id:row.id,data:structuredClone(data)}}}}}};
 });
 await page.addScriptTag({content:source});
 await page.evaluate(async()=>{
  const person={resourceName:'people/fixture',names:[{givenName:'Nombre',familyName:'Apellido'}],nicknames:[{value:'Alias'}],phoneNumbers:[{value:'+34900000001'}]};
  await window.testApi.persistMatchingVerification(window.currentContact,null,[person]);
  window.testApi.renderVerifiedCard(document.getElementById('profile'),window.currentContact,null);
  window.testApi.renderVerifiedCard(document.getElementById('whatsapp'),window.waLiveState.contact,window.waLiveState.selected);
 });
 await expect(page.locator('details')).toHaveCount(2);
 expect(await page.locator('details[open]').count()).toBe(0);
 expect(await page.evaluate(()=>window.writeCount)).toBe(1);
 expect(await page.evaluate(()=>{const {TPF_CONTACT_VERIFIED,...rest}=window.currentContact.data;return JSON.stringify(rest)===window.before})).toBe(true);
 await page.locator('#profile summary').click();await expect(page.locator('#profile [data-review-link]')).toBeVisible();
});
