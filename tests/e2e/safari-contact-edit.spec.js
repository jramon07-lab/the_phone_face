const {test,expect}=require('@playwright/test');
test.use({browserName:'webkit',trace:'off',video:'off',extraHTTPHeaders:{}});
test.beforeEach(async({page,baseURL})=>{
 // Preview access headers belong only to our deployment, never to the CDN or Auth API.
 const origin=new URL(baseURL).origin;
 await page.route(url=>url.origin===origin,route=>route.continue({headers:{
  ...route.request().headers(),
  'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  'x-vercel-set-bypass-cookie':'true'
 }}));
 page.on('requestfailed',request=>{
  const url=new URL(request.url());
  if(url.origin===origin||url.hostname.endsWith('.supabase.co'))console.log('WEBKIT_NETWORK_FAILURE',url.origin+url.pathname,request.failure()?.errorText);
 });
});
async function login(page){
 await page.goto('/');await page.waitForFunction(()=>typeof sb!=='undefined'&&!!sb);await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);await page.locator('#signin').click();await expect(page.locator('#app')).toBeVisible({timeout:30000});
}
test('WebKit: editor de contacto compacto, escritura y cancelación sin modificar datos',async({page})=>{
 await login(page);
 const id=await page.evaluate(async()=>(await sb.from('records').select('id').limit(1)).data?.[0]?.id);
 expect(id).toBeTruthy();await page.evaluate(id=>window.openContact(id),id);await expect(page.locator('#contactModal')).toBeVisible();
 await page.locator('#contactModal .cpRefEdit').click();await expect(page.locator('#tpfContactsCreateBack')).toBeVisible();
 const field=page.locator('#tpfCreateFirst'),original=await field.inputValue();
 await field.fill('Comprobación WebKit sin guardar');await expect(field).toHaveValue('Comprobación WebKit sin guardar');await expect(page.locator('#tpfContactsCreateSave')).toBeVisible();
 await field.fill(original);await page.locator('#tpfContactsCreateCancel').click();await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();
});
test('WebKit móvil: ficha, oportunidades y agenda caben y se pueden abrir',async({page})=>{
 await login(page);
 const id=await page.evaluate(async()=>(await sb.from('records').select('id').limit(1)).data?.[0]?.id);
 await page.setViewportSize({width:390,height:844});await page.goto('/movil/#/contact/'+id);
 if(await page.locator('#mobileLogin').isVisible()){await page.locator('#mobileEmail').fill(process.env.CRM_TEST_EMAIL);await page.locator('#mobilePassword').fill(process.env.CRM_TEST_PASSWORD);await page.locator('#mobileLoginForm button[type="submit"]').click();}
 await expect(page.locator('#mobileApp')).toBeVisible({timeout:30000});
 await expect(page.locator('[data-action="profile-tab"][data-tab="opportunities"]')).toBeVisible({timeout:30000});
 await page.locator('[data-action="profile-tab"][data-tab="opportunities"]').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.goto('/movil/#/agenda');await expect(page.locator('#mobileApp')).toBeVisible({timeout:30000});
 await expect(page.locator('#mobileView')).toContainText(/Agenda|Calendario|recordatorio|tarea/i);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
