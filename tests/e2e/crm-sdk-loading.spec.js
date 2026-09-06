const {test,expect}=require('@playwright/test');

for(const browserName of ['chromium','webkit']){
 test.describe(`Conexión sin CDN: ${browserName}`,()=>{
  test.use({browserName,trace:'off',video:'off'});
  test('PC y móvil cargan el cliente aunque el CDN no responda',async({page})=>{
   await page.route(url=>['cdn.jsdelivr.net','unpkg.com'].includes(url.hostname),route=>route.abort());
   for(const path of ['/','/movil/']){
    await page.goto(path);
    await expect.poll(()=>page.evaluate(()=>typeof window.supabase?.createClient)).toBe('function');
    await expect(page.locator(path==='/'?'#signin':'#mobileLoginForm button[type="submit"]')).toBeVisible();
   }
  });
 });
}
