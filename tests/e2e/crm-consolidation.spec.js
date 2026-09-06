const {test,expect}=require('@playwright/test');
test.describe.configure({mode:'serial'});
test.use({trace:'off',video:'off'}); // Keep authentication inputs out of recordings.
async function login(page){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
 await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
 await page.locator('#signin').click();
 await expect(page.locator('#app')).toBeVisible({timeout:30000});
 await expect.poll(()=>page.evaluate(()=>typeof window.TPFTaskModel?.save)).toBe('function');
}
async function close(page){await page.locator('#agendaCloseCreate').click();await expect(page.locator('#agendaCreateCard')).not.toHaveClass(/open/);}
async function compact(page){
 const dialog=page.locator('.agendaCompactBackdrop');await expect(dialog).toHaveCount(1);await expect(dialog).toBeVisible();
 const rect=await page.locator('#agendaCreateCard').boundingBox(),v=page.viewportSize();
 expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(v.width+1);expect(rect.y+rect.height).toBeLessThanOrEqual(v.height+1);
 await expect(page.locator('#agendaSave')).toBeVisible();
}
test('Demo: crear, editar y abrir una misma tarea desde las entradas del CRM y móvil',async({page})=>{
 test.setTimeout(180000);await login(page);
 // Only the task created by this test is changed/deleted. It has no delivery or notification.
 const title='DEMO VALIDACIÓN '+Date.now();let id;
 try{
  await page.locator('.nav[data-view="agenda"]').first().click();
  await page.locator('#agendaOpenCreateToolbar').click();await compact(page);
  await page.locator('#agendaTitle').fill(title);
  await page.evaluate(()=>{document.getElementById('agendaStarts').value='2035-01-15T10:00';for(const id of ['agendaNotifyApp','agendaNotifyEmail','agendaSyncGoogle'])document.getElementById(id).checked=false;document.querySelectorAll('.agendaReminderPreset').forEach(n=>n.checked=false);});
  const savedPromise=page.waitForResponse(r=>r.url().includes('/rest/v1/agenda_items')&&r.request().method()==='POST');
  await page.locator('#agendaSave').click();const response=await savedPromise;expect(response.ok()).toBeTruthy();id=(await response.json())[0]?.id;expect(id).toBeTruthy();
  await expect(page.locator('#agendaCreateCard')).not.toHaveClass(/open/);
  // The same item is reopened through all public adapters, including calendar.
  for(const entry of ['openAgendaItem','editAgendaItem','openContactTaskDetail','waTaskEdit']){
   await page.evaluate(async({entry,id})=>{await window[entry](id);},{entry,id});await compact(page);
   await expect(page.locator('#agendaTitle')).toHaveValue(title);await expect(page.locator('#agendaNotifyApp')).not.toBeChecked();await close(page);
  }
  await page.evaluate(id=>window.openAgendaItem(id),id);await page.locator('#agendaTitle').fill(title+' EDITADA');
  const updatedPromise=page.waitForResponse(r=>r.url().includes('/rest/v1/agenda_items')&&r.request().method()==='PATCH');
  await page.locator('#agendaSave').click();expect((await updatedPromise).ok()).toBeTruthy();await expect(page.locator('#agendaCreateCard')).not.toHaveClass(/open/);
  const facts=await page.evaluate(async()=>{const contacts=await TPFRecordLinks.load(sb);await loadSales();const lookup=TPFRecordLinks.index(contacts);return {contactId:contacts[0]?.id,opportunityId:salesCache.opportunities.find(o=>TPFRecordLinks.owner(o,lookup,'opportunity'))?.id};});
  expect(facts.contactId).toBeTruthy();await page.evaluate(id=>window.openContact(id),facts.contactId);await page.evaluate(()=>openContactTaskPage());await compact(page);await close(page);
  if(facts.opportunityId){await page.evaluate(id=>window.openSalesTaskForOpportunity(id),facts.opportunityId);await compact(page);await close(page);}
  await page.goto('/movil/#/task/'+id,{waitUntil:'domcontentloaded'});
  if(await page.locator('#mobileLogin').isVisible()){await page.locator('#mobileEmail').fill(process.env.CRM_TEST_EMAIL);await page.locator('#mobilePassword').fill(process.env.CRM_TEST_PASSWORD);await page.locator('#mobileLoginForm button[type="submit"]').click();}
  await expect(page.locator('#mobileApp')).toBeVisible({timeout:30000});
  await expect(page.locator('#editTaskTitle')).toHaveValue(title+' EDITADA',{timeout:30000});
  await expect(page.locator('#editTaskNotifyApp')).not.toBeChecked();
  await page.locator('#editTaskTitle').fill(title+' MÓVIL');const mobileSaved=page.waitForResponse(r=>r.url().includes('/rest/v1/agenda_items')&&r.request().method()==='PATCH');await page.locator('[data-action="save-task-detail"]').click();expect((await mobileSaved).ok()).toBeTruthy();await expect(page.locator('#editTaskTitle')).toHaveValue(title+' MÓVIL');
  await page.goto('/');await expect(page.locator('#app')).toBeVisible({timeout:30000});await page.evaluate(id=>window.openAgendaItem(id),id);await compact(page);await expect(page.locator('#agendaTitle')).toHaveValue(title+' MÓVIL');await close(page);
 }finally{
  if(id){await page.goto('/');await expect(page.locator('#app')).toBeVisible({timeout:30000});
   const own=await page.evaluate(async id=>{const r=await sb.from('agenda_items').select('title').eq('id',id).single();return r.data?.title;},id);expect(own).toContain(title);
   page.once('dialog',dialog=>dialog.accept());const removed=page.waitForResponse(r=>r.url().includes('/rest/v1/agenda_items')&&r.request().method()==='DELETE');await page.evaluate(id=>window.deleteAgenda(id),id);expect((await removed).ok()).toBeTruthy();
  }
 }
});

test('Demo: copia subida, descargada y descifrada desde Drive',async({page})=>{
 test.setTimeout(180000);await login(page);
 // This creates a backup only; no restore and no deletion of existing Drive files.
 const result=await page.evaluate(async()=>{const {data}=await sb.auth.getSession();const r=await fetch('/api/crm-backup?action=run',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token}});const body=await r.json();return {status:r.status,ok:body.ok,verification:body.verification,counts:body.counts,error:body.error};});
 expect(result.status,result.error).toBe(200);expect(result.ok).toBe(true);expect(result.verification).toBe('download-decrypt-counts');expect(Object.keys(result.counts||{})).toHaveLength(38);
});
