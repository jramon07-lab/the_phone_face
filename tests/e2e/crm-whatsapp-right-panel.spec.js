const { test, expect } = require('@playwright/test');

async function login(page){
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
}

async function openWhatsAppMatchedContactWithTask(page){
  await page.locator('.nav[data-view="whatsapplive"]').click();
  await expect(page.locator('#view-whatsapplive')).toBeVisible({timeout:10000});
  const chats=page.locator('#waLiveChats .waChatRow');
  await expect(chats.first()).toBeVisible({timeout:30000});
  const n=Math.min(await chats.count(),30);
  for(let i=0;i<n;i++){
    await chats.nth(i).click();
    await expect(page.locator('#waContactCard')).toBeVisible({timeout:10000});
    await page.waitForTimeout(700);
    const matched=await page.evaluate(()=>typeof waLiveState!=='undefined'&&!!waLiveState.contact);
    const hasTask=await page.locator('#waSideTasks .waSideItem').count()>0;
    if(matched&&hasTask){
      await expect(page.locator('#waSideOpenContact')).toBeVisible({timeout:10000});
      await expect(page.locator('#waSideTasks .tpfWaTaskEdit').first()).toBeVisible({timeout:10000});
      console.log('MATCHED_CHAT_WITH_TASK_INDEX',i);
      console.log('TPF_MODULES',JSON.stringify(await page.evaluate(()=>window.TPFModules?.status?.()||[])));
      return;
    }
  }
  throw new Error('No matched CRM contact with a task found in first 30 WhatsApp chats');
}

test('WhatsApp reutiliza oportunidad y tareas nativas de Contactos', async ({page})=>{
  await login(page);
  await openWhatsAppMatchedContactWithTask(page);

  await page.locator('#waSideNewOpp').click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:10000});
  await expect(page.locator('#oppModalHeading')).toHaveText(/Nueva oportunidad/i);
  await page.evaluate(()=>document.getElementById('oppDetailModal')?.classList.add('hidden'));

  await page.locator('#waSideNewTask').click();
  await expect(page.locator('#cpTaskPage')).toBeVisible({timeout:10000});
  await expect(page.locator('#cpTaskTitle')).toBeEditable();
  await page.evaluate(()=>{
    document.getElementById('cpTaskPage')?.classList.add('hidden');
    document.getElementById('contactModal')?.classList.add('hidden');
  });

  await page.locator('#waSideTasks .tpfWaTaskEdit').first().click();
  await expect(page.locator('#cpTaskDetailPage')).toBeVisible({timeout:10000});
  await expect(page.locator('#cpTaskDetailTitle')).toBeEditable();
  await expect(page.locator('#cpTaskDetailSave')).toBeVisible();
  await page.evaluate(()=>{
    document.getElementById('cpTaskDetailPage')?.classList.add('hidden');
    document.getElementById('contactModal')?.classList.add('hidden');
  });

  await page.locator('#waSideViewTasks').click();
  await expect(page.locator('#tpfWaTasksPage')).toBeVisible({timeout:10000});
});
