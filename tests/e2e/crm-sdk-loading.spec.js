const {test,expect}=require('@playwright/test');
test.use({trace:'off',video:'off'});
 test('Chromium: PC y móvil cargan la conexión aunque el CDN no responda',async({page})=>{
  await page.route(url=>['cdn.jsdelivr.net','unpkg.com'].includes(url.hostname),route=>route.abort());
  for(const path of ['/','/movil/']){
   await page.goto(path);
   await expect.poll(()=>page.evaluate(()=>typeof window.supabase?.createClient)).toBe('function');
   await expect(page.locator(path==='/'?'#signin':'#mobileLoginForm button[type="submit"]')).toBeVisible();
  }
 });
