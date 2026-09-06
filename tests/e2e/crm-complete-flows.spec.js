const {test,expect}=require('@playwright/test');
test.use({trace:'off',video:'off'});
async function login(page){
 await page.goto('/');
 if(await page.locator('#login').isVisible()){
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);await page.locator('#signin').click();
 }
 await expect(page.locator('#app')).toBeVisible({timeout:30000});
}
async function mobile(page,route){
 await page.setViewportSize({width:390,height:844});await page.goto('/movil/#/'+route);
 if(await page.locator('#mobileLogin').isVisible()){
  await page.locator('#mobileEmail').fill(process.env.CRM_TEST_EMAIL);await page.locator('#mobilePassword').fill(process.env.CRM_TEST_PASSWORD);await page.locator('#mobileLoginForm button[type="submit"]').click();
 }
 await expect(page.locator('#mobileApp')).toBeVisible({timeout:30000});
}
async function contactRows(page,marker){return page.evaluate(async marker=>{const r=await sb.from('records').select('id,data').ilike('data->>NOMBRE Y APELLIDOS','%'+marker+'%');if(r.error)throw Error(r.error.message);return r.data;},marker);}
async function createContact(page,marker,last){
 await page.locator('.nav[data-view="database"]').click();await page.locator('#tpfContactsAdd').click();
 await expect(page.locator('#tpfContactsCreateBack')).toBeVisible();await page.locator('#tpfCreateFirst').fill(marker);await page.locator('#tpfCreateLast').fill(last);
 // The unique synthetic contacts have no delivery address, labels or welcome.
 await expect(page.locator('#tpfCreatePhone')).toHaveValue('');await expect(page.locator('#tpfCreateEmail')).toHaveValue('');
 if(await page.locator('#tpfCreateWelcome').count())await expect(page.locator('#tpfCreateWelcome')).not.toBeChecked();
 await page.locator('#tpfContactsCreateSave').click();await expect(page.locator('#tpfContactsCreateBack')).toBeHidden({timeout:15000});
 const rows=await contactRows(page,marker);expect(rows).toHaveLength(1);return rows[0].id;
}
async function openContact(page,id){await page.evaluate(id=>window.openContact(id),id);await expect(page.locator('#contactModal')).toBeVisible();await expect.poll(()=>page.evaluate(()=>currentContact?.id)).toBe(id);}
async function cleanOwnData(page,marker){
 await page.setViewportSize({width:1440,height:900});await login(page);
 // Deletion always uses the application's public action and only verified test IDs.
 await page.evaluate(()=>window.loadSales());
 const ids=await page.evaluate(marker=>(salesCache.opportunities||[]).filter(x=>String(x.title).includes(marker)).map(x=>x.id),marker);
 for(const id of ids){page.once('dialog',d=>d.accept());await page.evaluate(id=>window.deleteOpp(id),id);}
 for(const row of await contactRows(page,marker)){
  await openContact(page,row.id);page.once('dialog',d=>d.accept());await page.locator('#contactDelete').click();await expect(page.locator('#contactModal')).toBeHidden();
 }
 const trash=await page.evaluate(async marker=>{const r=await sb.from('crm_trash').select('id,label').ilike('label','%'+marker+'%');if(r.error)throw Error(r.error.message);return r.data;},marker);
 for(const item of trash){page.once('dialog',d=>d.accept());await page.evaluate(id=>window.purgeTrash(id),item.id);}
 expect(await contactRows(page,marker)).toHaveLength(0);
}

test('Contactos: alta, edición PC/móvil, buscador, borrado inmediato y papelera',async({page})=>{
 test.setTimeout(180000);await login(page);const marker='Validacion '+Date.now();
 const allowed=await page.evaluate(()=>['can_create_database','can_edit_records','can_delete_records'].every(k=>crmCan(k)));
 test.skip(!allowed,'La cuenta demo no permite el ciclo completo de contactos.');
 try{
  const id=await createContact(page,marker,'Contacto');
  await page.locator('#tpfContactsSearch').fill(marker);await expect(page.locator('#tpfContactsRows tr')).toHaveCount(1);
  await page.locator('#tpfContactsRows .tpfContactPencil').click();await expect(page.locator('#tpfCreateFirst')).toHaveValue(marker);
  await page.locator('#tpfCreateLast').fill('Editado');await page.locator('#tpfCreateNotes').fill('Nota de validación');await page.locator('#tpfContactsCreateSave').click();
  await expect(page.locator('#tpfContactsRows')).toContainText('Editado');expect((await contactRows(page,marker))[0].data.NOTAS).toBe('Nota de validación');
  await mobile(page,'edit-contact/'+id);await expect(page.locator('#editLast')).toHaveValue('Editado',{timeout:30000});await page.locator('#editLast').fill('Movil');await page.locator('[data-action="save-contact"]').click();await expect(page.locator('#mobileView')).toContainText(marker+' Movil');
  await page.setViewportSize({width:1440,height:900});await login(page);await openContact(page,id);await expect(page.locator('#contactName')).toHaveValue(marker+' Movil');
  await page.locator('#contactClose').click();await page.locator('.nav[data-view="database"]').click();await page.locator('#tpfContactsSearch').fill(marker);await expect(page.locator('#tpfContactsRows tr')).toHaveCount(1);
  await page.locator('#tpfContactsRows [data-action="open"]').first().click();page.once('dialog',d=>d.accept());await page.locator('#contactDelete').click();await expect(page.locator('#contactModal')).toBeHidden();
  await expect(page.locator('#tpfContactsRows')).not.toContainText(marker);expect(await contactRows(page,marker)).toHaveLength(0);
  const trash=await page.evaluate(async id=>{const r=await sb.from('crm_trash').select('id,payload').eq('entity_id',id).single();if(r.error)throw Error(r.error.message);return {id:r.data.id,originalId:r.data.payload.record.id};},id);expect(trash.originalId).toBe(id);
  await page.locator('.nav[data-view="trash"]').click();await expect(page.locator('#trashList')).toContainText(marker);
  await page.locator('#trashList .trashItem').filter({hasText:marker}).getByRole('button',{name:'Restaurar',exact:true}).click();
  await expect.poll(async()=> (await contactRows(page,marker)).length).toBe(1);
  const restored=(await contactRows(page,marker))[0];expect(restored.id,'Restaurar debe conservar la identidad para que los vínculos sigan apuntando a la misma ficha').toBe(id);
  await page.locator('.nav[data-view="database"]').click();await page.locator('#tpfContactsSearch').fill(marker);await expect(page.locator('#tpfContactsRows')).toContainText(marker+' Movil');
 }finally{await cleanOwnData(page,marker);}
});

test('Titulares y ventas: vínculo, oportunidad gestionada, DNI, lista/tablero y móvil',async({page})=>{
 test.setTimeout(210000);await login(page);const marker='Integral '+Date.now();
 const allowed=await page.evaluate(()=>['can_create_database','can_edit_records','can_delete_records','can_edit_sales'].every(k=>crmCan(k)));
 test.skip(!allowed,'La cuenta demo no permite contactos y ventas.');
 const active=await page.evaluate(async()=>{const r=await sb.from('crm_automations').select('id').eq('enabled',true).eq('trigger_type','opportunity_stage');if(r.error)throw Error(r.error.message);return r.data.length;});
 test.skip(active>0,'Existen automatizaciones de fase activas: se requiere un panel de prueba aislado para crear ventas.');
 try{
  const manager=await createContact(page,marker+' Gestor','Demo'),holder=await createContact(page,marker+' Titular','Demo');
  await page.evaluate(id=>window.TPFContactsList.edit(id),holder);await page.locator('#tpfCreateDni').fill('DEMO'+Date.now());await page.locator('#tpfContactsCreateSave').click();await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();
  const dni=(await contactRows(page,marker+' Titular'))[0].data.DNI;
  await page.evaluate(id=>window.TPFContactsList.edit(id),manager);await page.locator('[data-rel-enabled]').check();await page.locator('[data-rel-add]').click();await page.locator('[data-rel-search]').fill(marker+' Titular');await page.locator('[data-rel-pick="'+holder+'"]').click();await page.locator('#tpfContactsCreateSave').click();await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();
  await openContact(page,manager);await page.locator('[data-rel-holders] > summary').click();await expect(page.locator('[data-rel-cards]')).toContainText(marker+' Titular');await expect(page.locator('[data-rel-cards]')).toContainText(dni);
  await page.locator('#cpNewOpp').click();await expect(page.locator('#oppDetailModal')).toBeVisible();await page.locator('#oppModalTitle').fill(marker+' Venta');await page.locator('#oppModalAmount').fill('12.34');await page.locator('#oppModalDate').fill('2035-01-15');
  await page.locator('[data-rel-other]').check();await page.locator('[data-rel-choice]').selectOption(holder);await page.locator('#oppModalSave').click();await expect(page.locator('#oppDetailModal')).toBeHidden({timeout:15000});
  const opp=await page.evaluate(async title=>{const r=await sb.from('sales_opportunities').select('id,record_id,contract_party,amount').eq('title',title).single();if(r.error)throw Error(r.error.message);return r.data;},marker+' Venta');expect(opp.record_id).toBe(holder);expect(opp.contract_party.contact_name).toBe(marker+' Gestor Demo');expect(opp.amount).toBe(12.34);
  await openContact(page,manager);await expect(page.locator('#cpOpportunities')).toContainText(marker+' Titular');await page.locator('#contactClose').click();
  await page.locator('.nav[data-view="sales"]').click();await page.evaluate(()=>window.loadSales());
  await page.evaluate(id=>window.openOpportunityCard(id),opp.id);await expect(page.locator('#tpfOpportunityParty')).toContainText(marker+' Titular');await expect(page.locator('#tpfOpportunityParty')).toContainText(dni);await page.locator('#oppModalClose').click();
  await mobile(page,'edit-opportunity/'+opp.id);await expect(page.locator('#editOppAmount')).toHaveValue('12.34',{timeout:30000});await page.locator('#editOppAmount').fill('23.45');await page.locator('[data-action="save-opportunity-detail"]').click();await expect(page.locator('#mobileView')).toContainText('23,45');
  await mobile(page,'contact/'+manager);await expect(page.locator('[data-action="profile-tab"][data-tab="opportunities"]')).toHaveText('Oportunidades (1)',{timeout:30000});
  await page.setViewportSize({width:1440,height:900});await login(page);expect(await page.evaluate(async id=>(await sb.from('sales_opportunities').select('amount').eq('id',id).single()).data.amount,opp.id)).toBe(23.45);
 }finally{await cleanOwnData(page,marker);}
});

test('Móvil: todas las secciones principales abren y caben en la pantalla',async({page})=>{
 test.setTimeout(150000);await mobile(page,'home');const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['home','contacts','opportunities','tasks','agenda','templates','labels','alerts','whatsapp']){
  await page.evaluate(route=>{location.hash='#/'+route;},route);await expect(page.locator('#mobileView')).not.toBeEmpty();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#mobileView')).not.toContainText('No se pudo abrir');
 }
 expect(errors).toEqual([]);
});

test('Sesión: cerrar y volver a entrar mantiene la protección de datos',async({page})=>{
 await login(page);await page.locator('#logout').click();await expect(page.locator('#login')).toBeVisible();await expect(page.locator('#app')).toBeHidden();
 const session=await page.evaluate(async()=>Boolean((await sb.auth.getSession()).data.session));expect(session).toBe(false);await login(page);
 const flags=await page.evaluate(()=>Object.fromEntries(Object.entries(perms||{}).filter(([k,v])=>typeof v==='boolean')));console.log('DEMO_PERMISSION_FLAGS',JSON.stringify(flags));
});
