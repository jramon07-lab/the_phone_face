const {test,expect}=require('@playwright/test');
test.use({trace:'off',video:'off',screenshot:'off'});
async function login(page){await page.goto('/');await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);await page.locator('#signin').click();await expect(page.locator('#app')).toBeVisible({timeout:30000});}

test('Accesos: WhatsApp y Telegram exigen sesión antes de leer o enviar',async({request})=>{
 for(const path of ['green','green-reply','green-file-safe','green-status','green-read-safe','telegram']){
  const r=path==='green'?await request.get('/api/green?action=summary'):await request.post('/api/'+path,{data:{}});
  expect(r.status(),path+' sin sesión CRM').toBe(401);expect((await r.json()).ok).toBe(false);
 }
 const expired=await request.get('/api/green?action=summary',{headers:{Authorization:'Bearer invalid-test-session'}});
 expect(expired.status()).toBe(401);
});

test('Accesos: sesión válida conserva WhatsApp y respeta administración',async({page})=>{
 await login(page);
 const result=await page.evaluate(async()=>{
  const r=await fetch('/api/green?action=state');const d=await r.json();
  const {data}=await sb.auth.getSession(),headers={Authorization:'Bearer '+data.session.access_token};
  const b=await fetch('/api/crm-backup?action=status',{headers});
  return {stateStatus:r.status,stateOk:d.ok,backupStatus:b.status,isAdmin:!!perms.is_admin};
 });
 expect(result.stateStatus).toBe(200);expect(result.stateOk).toBe(true);expect(result.backupStatus).toBe(result.isAdmin?200:403);
});

test('Descargas: archivo autenticado conserva bytes y no pone credenciales en el enlace',async({page})=>{
 await login(page);let authorized=false;const bytes=Buffer.from('%PDF-1.4\nCRM synthetic download\n%%EOF');
 await page.route('**/api/green?action=download&chatId=synthetic-audit*',route=>{authorized=/^Bearer \S+$/.test(route.request().headers().authorization||'');expect(route.request().url()).not.toMatch(/token|Bearer/);return route.fulfill({status:200,contentType:'application/pdf',body:bytes});});
 const pending=page.waitForEvent('download');await page.evaluate(()=>window.TPFAPIAuth.download('/api/green?action=download&chatId=synthetic-audit&idMessage=test','auditoria.pdf'));
 const download=await pending;expect(authorized).toBe(true);expect(download.suggestedFilename()).toBe('auditoria.pdf');
 const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);expect(Buffer.concat(chunks).equals(bytes)).toBe(true);
});
