const { test, expect } = require('@playwright/test');

async function login(page){
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
}

async function openWhatsAppContact(page){
  await page.locator('.nav[data-view="whatsapplive"]').click();
  await expect(page.locator('#view-whatsapplive')).toBeVisible({timeout:10000});
  const chat=page.locator('#waChatList .waChat').first();
  await expect(chat).toBeVisible({timeout:30000});
  await chat.click();
  await expect(page.locator('#waSidePanel')).toBeVisible({timeout:20000});
  await expect(page.locator('#waSideOpenContact')).toBeVisible({timeout:20000});
}

test('WhatsApp panel derecho usa navegación nativa de oportunidades y tareas', async ({page})=>{
  await login(page);
  await openWhatsAppContact(page);
  const chatId=await page.evaluate(()=>String(waLiveState?.selected?.id||''));

  await page.locator('#waSideViewOpps').click();
  await expect(page.locator('#contactModal')).toBeVisible({timeout:10000});
  await expect(page.locator('#cpTaskPage')).toBeHidden();
  await expect(page.locator('#cpTaskDetailPage')).toBeHidden();
  const visibleOpp=page.locator('#cpTimeline .cpEvent').filter({hasText:/oportunidad/i}).first();
  if(await visibleOpp.count())await expect(visibleOpp).toBeVisible();
  await page.locator('#contactClose').click();
  await expect(page.locator('#contactModal')).toBeHidden({timeout:5000});
  expect(await page.evaluate(()=>String(waLiveState?.selected?.id||''))).toBe(chatId);

  await page.locator('#waSideViewTasks').click();
  await expect(page.locator('#contactModal')).toBeVisible({timeout:10000});
  const visibleTask=page.locator('#cpTimeline .cpEvent').filter({hasText:/tarea/i}).first();
  if(await visibleTask.count())await expect(visibleTask).toBeVisible();
  await page.locator('#contactClose').click();
  await expect(page.locator('#contactModal')).toBeHidden({timeout:5000});

  const task=page.locator('#waSideTasks .waSideItem').first();
  if(await task.count()){
    await task.click();
    await expect(page.locator('#cpTaskDetailPage')).toBeVisible({timeout:10000});
    await expect(page.locator('#cpTaskDetailTitle')).toBeEditable();
    await expect(page.locator('#cpTaskDetailSave')).toBeVisible();
    await expect(page.locator('#cpTaskMarkDone,#cpTaskReopen')).toHaveCount(2);
    await expect(page.locator('#cpTaskDelete')).toBeVisible();
    await page.locator('#cpTaskDetailBack').click();
    await expect(page.locator('#cpTaskDetailPage')).toBeHidden({timeout:5000});
    expect(await page.evaluate(()=>String(waLiveState?.selected?.id||''))).toBe(chatId);
  }

  const addTask=page.locator('#waSideTasks').locator('xpath=preceding::*[contains(normalize-space(.),"Tareas")][1]').locator('button').first();
  if(await addTask.count()){
    await addTask.click();
    await expect(page.locator('#cpTaskPage')).toBeVisible({timeout:10000});
    await expect(page.locator('#cpTaskTitle')).toBeEditable();
    await page.locator('#cpTaskBack').click();
  }
});
