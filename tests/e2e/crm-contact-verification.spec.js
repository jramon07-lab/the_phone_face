const {test,expect}=require('@playwright/test');

test('Identidad: apodo aislado y verificación reutilizada sin consultas a Google',async({page,request})=>{
  const response=await request.get('/js/modules/contact-google-inline.js?v=20260912-profile-nickname-1');
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
  await expect(page.locator('#waSideNickname')).toHaveText('Alias sólo A');
  await page.evaluate(async()=>{for(let i=0;i<10;i++)await window.TPFContactGoogleInline.refreshWhatsapp()});
  expect(await page.evaluate(()=>window.googleReads)).toBe(0);
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
