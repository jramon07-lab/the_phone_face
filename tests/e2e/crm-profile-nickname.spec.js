const {test,expect}=require('@playwright/test');

test('Ficha: nombre arriba y apodo debajo sin cambiar datos ni acciones',async({page,request})=>{
 const [script,css]=await Promise.all([request.get('/js/modules/contact-google-inline.js?v=20260912-profile-nickname-1'),request.get('/assets/contact-desktop.css?v=20260912-profile-nickname-1')]);
 expect(script.ok()).toBeTruthy();expect(css.ok()).toBeTruthy();const style=await css.text();
 await page.route('**/__profile-nickname-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><style>${style}</style></head><body><div id="contactModal" class="tpfContactDesktop tpfContactReference"><div class="contactProfile"><div class="cpIdentity"><input id="contactName" class="cpName" readonly><div class="cpQuick"><button id="originalAction">Acción existente</button></div></div><div class="cpRight"></div></div></div></body></html>`}));
 await page.setViewportSize({width:1440,height:900});await page.goto('/__profile-nickname-fixture');
 await page.evaluate(()=>{
  window.currentContact={id:'fixture-a',data:{NOMBRE:'Antonio',APELLIDOS:'Lopez Arco',APODO:'Apodo de prueba'}};
  window.originalData=JSON.stringify(window.currentContact);window.actionCount=0;window.externalCalls=0;
  document.getElementById('originalAction').onclick=()=>window.actionCount++;
  window.googleContactsConnected=()=>false;
  window.googleApi=()=>{window.externalCalls++;throw Error('Unexpected Google call')};
  window.sb={from(){window.externalCalls++;throw Error('Unexpected database call')}};
  window.TPFModules={register(_name,module){module.install()}};
 });
 await page.addScriptTag({content:await script.text()});
 await page.evaluate(()=>window.TPFContactGoogleInline.refreshProfile());
 await expect(page.locator('#cpProfileDisplayName')).toHaveText('Antonio Lopez Arco');await expect(page.locator('#cpProfileNickname')).toHaveText('Apodo de prueba');
 await expect(page.locator('#contactName')).toHaveValue('Antonio Lopez Arco Apodo de prueba');await expect(page.locator('#contactName')).toBeHidden();
 const name=await page.locator('#cpProfileDisplayName').boundingBox(),alias=await page.locator('#cpProfileNickname').boundingBox();expect(alias.y).toBeGreaterThanOrEqual(name.y+name.height);
 expect(await page.locator('#cpProfileNickname').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeLessThan(await page.locator('#cpProfileDisplayName').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)));
 expect(await page.evaluate(()=>JSON.stringify(window.currentContact)===window.originalData)).toBe(true);
 await page.locator('#originalAction').click();expect(await page.evaluate(()=>window.actionCount)).toBe(1);
 await page.evaluate(async()=>{window.currentContact={id:'fixture-b',data:{NOMBRE:'Otro',APELLIDOS:'Cliente',APODO:''}};await window.TPFContactGoogleInline.refreshProfile()});
 await expect(page.locator('#cpProfileDisplayName')).toHaveText('Otro Cliente');await expect(page.locator('#cpProfileNickname')).toBeHidden();await expect(page.locator('#cpProfileNickname')).toHaveText('');
 await page.evaluate(async()=>{window.currentContact.data.APODO='Nuevo apodo';for(let i=0;i<20;i++)await window.TPFContactGoogleInline.refreshProfile()});
 await expect(page.locator('#cpProfileNickname')).toHaveText('Nuevo apodo');expect(await page.locator('#cpProfileIdentityText').count()).toBe(1);
 await page.setViewportSize({width:800,height:900});await expect(page.locator('#cpProfileNickname')).toBeVisible();
 await page.evaluate(()=>document.getElementById('contactModal').classList.add('tpf-contact-editing'));await expect(page.locator('#cpProfileIdentityText')).toBeHidden();await expect(page.locator('#contactName')).toBeVisible();
 expect(await page.evaluate(()=>window.externalCalls)).toBe(0);
});
