const { test, expect } = require('@playwright/test');

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
  const n=Math.min(await chats.count(),30);
  for(let i=0;i<n;i++){
    await chats.nth(i).click();
    await expect(page.locator('#waContactCard')).toBeVisible({timeout:10000});
    const matched=await page.evaluate(()=>!!window.waLiveState?.contact);
    if(matched){
      await expect(page.locator('#waSideOpenContact')).toBeVisible({timeout:10000});
      console.log('MATCHED_CHAT_INDEX',i);
      console.log('TPF_MODULES',JSON.stringify(await page.evaluate(()=>window.TPFModules?.status?.()||[])));
      return;
    }
  }
  throw new Error('No matched CRM contact found in first 30 WhatsApp chats');
}

test('WhatsApp reutiliza oportunidad y tareas nativas de Contactos', async ({page})=>{
  await login(page);
  await openWhatsAppMatchedContact(page);

  await page.locator('#waSideNewOpp').click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:10000});
  await expect(page.locator('#oppModalHeading')).toHaveText(/Nueva oportunidad/i);
  await page.evaluate(()=>document.getElementById('oppDetailModal')?.classList.add('hidden'));

  await page.locator('#waSideNewTask').click();
  await expect(page.locator('#cpTaskPage')).toBeVisible({timeout:10000});
  await expect(page.locator('#cpTaskTitle')).toBeEditable();
  await page.evaluate(()=>document.getElementById('cpTaskPage')?.classList.add('hidden'));

  const task=page.locator('#waSideTasks .waSideItem').first();
  if(await task.count()){
    await task.click();
    await expect(page.locator('#cpTaskDetailPage')).toBeVisible({timeout:10000});
    await expect(page.locator('#cpTaskDetailTitle')).toBeEditable();
    await page.evaluate(()=>document.getElementById('cpTaskDetailPage')?.classList.add('hidden'));
  }

  await page.locator('#waSideViewTasks').click();
  await expect(page.locator('#tpfWaTasksPage')).toBeVisible({timeout:10000});
});
