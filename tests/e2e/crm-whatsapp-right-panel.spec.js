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
  const chat=page.locator('#waLiveChats .waChatRow').first();
  await expect(chat).toBeVisible({timeout:30000});
  await chat.click();
  await expect(page.locator('#waSidePanel')).toBeVisible({timeout:20000});
  await expect(page.locator('#waSideOpenContact')).toBeVisible({timeout:20000});
}

test('WhatsApp reutiliza oportunidad y tareas nativas de Contactos', async ({page})=>{
  await login(page);
  await openWhatsAppContact(page);

  await page.locator('#waSideNewOpp').click();
  await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:10000});
  await expect(page.locator('#oppModalHeading')).toHaveText(/Nueva oportunidad/i);
  await page.locator('#oppModalCloseX').click();
  await expect(page.locator('#oppDetailModal')).toBeHidden({timeout:5000});

  await page.locator('#waSideNewTask').click();
  await expect(page.locator('#cpTaskPage')).toBeVisible({timeout:10000});
  await expect(page.locator('#cpTaskTitle')).toBeEditable();
  await page.locator('#cpTaskBack').click();
  await expect(page.locator('#cpTaskPage')).toBeHidden({timeout:5000});

  const task=page.locator('#waSideTasks .waSideItem').first();
  if(await task.count()){
    const edit=task.getByRole('button',{name:/editar/i});
    if(await edit.count())await edit.click(); else await task.click();
    await expect(page.locator('#cpTaskDetailPage')).toBeVisible({timeout:10000});
    await expect(page.locator('#cpTaskDetailTitle')).toBeEditable();
    await page.locator('#cpTaskDetailBack').click();
    await expect(page.locator('#cpTaskDetailPage')).toBeHidden({timeout:5000});
  }

  await page.locator('#waSideViewTasks').click();
  if(await page.locator('#waSideTasks .waSideItem').count()){
    await expect(page.locator('#cpTaskDetailPage')).toBeVisible({timeout:10000});
  }
});
