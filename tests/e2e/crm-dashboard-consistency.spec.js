const {test,expect}=require('@playwright/test');

async function login(page){
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
}

test('Inicio conserva el último resumen completo al salir, volver y fallar una consulta',async({page})=>{
  await login(page);
  await page.locator('.nav[data-view="dashboard"]').click();
  await expect(page.locator('#view-dashboard')).toBeVisible();
  await expect(page.locator('#mContacts')).not.toHaveText('—',{timeout:15000});
  await page.waitForTimeout(2500);
  await expect(page.locator('#view-dashboard')).toHaveClass(/tpfDashPro/);
  await expect(page.locator('#view-dashboard .dashItem')).toHaveCount(0);

  const ids=['mOppTotal','mOppOpen','mOppExpired','mTasks','mTasksToday','mContacts','mConversion'];
  const before=await page.locator(ids.map(id=>`#${id}`).join(',')).allTextContents();

  await page.route('**/rest/v1/sales_opportunities*',route=>route.abort('failed'));
  await page.locator('.nav[data-view="agenda"]').click();
  await expect(page.locator('#view-agenda')).toBeVisible();
  await page.locator('.nav[data-view="dashboard"]').click();
  await expect(page.locator('#view-dashboard')).toBeVisible();
  await expect(page.locator('#dashRefresh')).toHaveAttribute('data-load-error','1',{timeout:15000});

  const after=await page.locator(ids.map(id=>`#${id}`).join(',')).allTextContents();
  expect(after).toEqual(before);
});
