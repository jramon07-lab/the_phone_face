const {test,expect}=require('@playwright/test');
test.use({trace:'off',video:'off',screenshot:'off'});
async function login(page,mobile=false){
 await page.goto(mobile?'/movil/#/more':'/');
 await page.locator(mobile?'#mobileEmail':'#email').fill(process.env.CRM_TEST_EMAIL);
 await page.locator(mobile?'#mobilePassword':'#password').fill(process.env.CRM_TEST_PASSWORD);
 await page.locator(mobile?'#mobileLoginForm button[type="submit"]':'#signin').click();
 await expect(page.locator(mobile?'#mobileApp':'#app')).toBeVisible({timeout:30000});
}
async function refreshOther(page){return page.evaluate(async()=>{
 const session=await sb.auth.refreshSession();if(session.error)throw Error('The second device lost its refresh session');
 const p=await sb.rpc('current_user_permissions');if(p.error)throw Error('The second device lost database access');
 return !!session.data?.session&&!!p.data?.user_id;
});}
test('Sesiones: salir en PC y móvil conserva la renovación del otro ordenador',async({browser},info)=>{
 test.setTimeout(120000);const devices=[],scopes=[];
 try{
  for(let i=0;i<3;i++){
   const context=await browser.newContext({baseURL:info.project.use.baseURL,extraHTTPHeaders:info.project.use.extraHTTPHeaders});
   // Never let a regression revoke other live users' sessions during this test.
   await context.route('**/auth/v1/logout**',async route=>{
    const scope=new URL(route.request().url()).searchParams.get('scope');scopes.push(scope);
    if(scope!=='local')return route.fulfill({status:400,json:{error:'Global logout blocked by the audit guard'}});
    return route.continue();
   });
   const page=await context.newPage();devices.push({context,page});await login(page,i===2);
  }
  await devices[0].page.locator('#logout').click();await expect(devices[0].page.locator('#login')).toBeVisible({timeout:15000});
  expect(await refreshOther(devices[1].page)).toBe(true);
  await devices[2].page.locator('[data-action="logout"]').click();await expect(devices[2].page.locator('#mobileLogin')).toBeVisible({timeout:15000});
  expect(await refreshOther(devices[1].page)).toBe(true);
  await devices[1].page.locator('#logout').click();await expect(devices[1].page.locator('#login')).toBeVisible({timeout:15000});
  expect(scopes).toEqual(['local','local','local']);
  console.log('SESSION_ISOLATION_VERIFIED: PC and mobile logout preserve the second PC refresh session and database permission; global logout is blocked by the audit guard.');
 }finally{for(const d of devices)await d.context.close();}
});
