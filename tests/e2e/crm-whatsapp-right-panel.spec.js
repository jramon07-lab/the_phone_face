const { test, expect } = require('@playwright/test');

test.beforeEach(async({page})=>{
 page.setDefaultTimeout(15000);
 await page.addInitScript(()=>{
  window.__oppVisibility=[];
  for(const method of ['add','remove','toggle']){
   const original=DOMTokenList.prototype[method];
   DOMTokenList.prototype[method]=function(...args){
    if(this===document.getElementById('oppDetailModal')?.classList){
     window.__oppVisibility.push({method,args,stack:new Error().stack?.split('\n').slice(1,7)});
     window.__oppVisibility=window.__oppVisibility.slice(-15);
    }
    return original.apply(this,args);
   };
  }
 });
});
test.afterEach(async({page},info)=>{
 if(info.status===info.expectedStatus||page.isClosed())return;
 console.log('UI_FAILURE_DIAGNOSTICS',JSON.stringify(await page.evaluate(()=>{
  const ancestors=id=>{let n=document.getElementById(id),out=[];while(n&&out.length<8){out.push({tag:n.tagName,id:n.id,classes:n.className,display:getComputedStyle(n).display,hidden:n.hidden});n=n.parentElement;}return out;};
  return {opportunity:window.__oppVisibility,automation:ancestors('tpfStepEditor'),task:ancestors('agendaEditStatus')};
 })));
});

async function login(page){
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
}

async function openWhatsAppMatchedContact(page){
  await page.locator('.nav[data-view="whatsapplive"]').click();
  await expect(page.locator('#view-whatsapplive')).toBeVisible({timeout:10000});
  const chats=page.locator('#waLiveChats .waChatRow');
  await expect(chats.first()).toBeVisible({timeout:30000});
  const n=Math.min(await chats.count(),40);
  let firstMatched=-1;
  for(let i=0;i<n;i++){
    await chats.nth(i).click();
    await expect(page.locator('#waContactCard')).toBeVisible({timeout:10000});
    await page.waitForTimeout(500);
    const matched=await page.evaluate(()=>typeof waLiveState!=='undefined'&&!!waLiveState.contact);
    if(matched){
      await expect(page.locator('#waSideOpenContact')).toBeVisible({timeout:10000});
      if(firstMatched<0)firstMatched=i;
      const taskRows=page.locator('#waSideTasks .cpTaskWrap, #waSideTasks .waTaskCard, #waSideTasks .waSideItem');
      if(await taskRows.count()){
        console.log('MATCHED_CHAT_INDEX',i);
        console.log('TPF_MODULES',JSON.stringify(await page.evaluate(()=>window.TPFModules?.status?.()||[])));
        return {hasTask:true};
      }
    }
  }
  if(firstMatched>=0){
    await chats.nth(firstMatched).click();
    await expect(page.locator('#waSideOpenContact')).toBeVisible({timeout:10000});
    return {hasTask:false};
  }
  throw new Error('No matched CRM contact found in first 40 WhatsApp chats');
}

test('WhatsApp reutiliza oportunidad y tareas nativas de Contactos', async ({page})=>{
  test.setTimeout(120000);
  await login(page);
  const matched=await openWhatsAppMatchedContact(page);

  if(matched.hasTask){
    const taskRow=page.locator('#waSideTasks .cpTaskWrap, #waSideTasks .waTaskCard, #waSideTasks .waSideItem').first();
    await expect(taskRow).toBeVisible({timeout:15000});
    const edit=taskRow.locator('button,a').filter({hasText:/^Editar$|Ver\s*\/\s*editar/i}).first();
    // Some sidebar layouts make the whole task row the opening control.
    if(await edit.count()) await edit.click();
    else await taskRow.click();
    await expect(page.locator('#agendaCreateCard')).toHaveClass(/\bopen\b/);
    await expect(page.locator('#agendaTitle')).toBeEditable();
    await expect(page.locator('#agendaSave')).toBeVisible();
    await page.locator('#agendaCloseCreate').click();
  }else{
    test.info().annotations.push({type:'info',description:'No había una tarea existente; se omite únicamente la apertura de detalle.'});
  }

  await page.locator('#waSideNewOpp').click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:10000});
  await expect(page.locator('#oppModalHeading')).toHaveText(/Nueva oportunidad/i);
  await page.locator('#oppModalClose').click();

  await page.locator('#waSideNewTask').click();
  await expect(page.locator('#agendaCreateCard')).toBeVisible({timeout:10000});
  await expect(page.locator('#agendaCreateCard')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#agendaTypeChoices [data-type]').first()).toBeVisible();
  await expect(page.locator('#agendaTitle')).toBeEditable();
  await expect(page.locator('#cpTaskPage')).toBeHidden();
  await page.locator('#agendaCloseCreate').click();
  await expect(page.locator('#view-whatsapplive')).toBeVisible({timeout:10000});

  if(matched.hasTask){
    const viewTasks=page.locator('#waSideViewTasks');
    await expect(viewTasks).toBeVisible({timeout:10000});
    await viewTasks.click();
    await expect(page.locator('#tpfWaTasksPage')).toBeVisible({timeout:10000});
  }
});
