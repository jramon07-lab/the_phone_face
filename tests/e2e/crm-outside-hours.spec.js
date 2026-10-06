const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test('Fuera de horario pide permiso en PC y móvil sin enviar al proveedor',async({page})=>{
 await page.clock.install({time:new Date('2026-10-06T20:24:00Z')});
 await page.route('https://fixture.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<html><body><button>Formulario</button></body></html>'}));
 let calls=0,choice='';
 await page.route('https://overfzbjtpjqxzbujezg.supabase.co/**',route=>{if(route.request().method()!=='OPTIONS'){calls++;choice=route.request().headers()['x-client-info'];}return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, x-client-info'},contentType:'application/json',body:'"fixture-contact-id"'});});
 await page.goto('https://fixture.test/');await page.addScriptTag({content:fs.readFileSync('js/modules/outside-hours-confirm.js','utf8')});
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>{window.result=null;fetch('https://overfzbjtpjqxzbujezg.supabase.co/rest/v1/rpc/crm_create_contact_guarded',{method:'POST',headers:{'content-type':'application/json','x-client-info':'test'},body:JSON.stringify({p_welcome:true,p_data:{NOMBRE:'Ejemplo'}})}).then(r=>window.result=r.status);});
  await expect(page.locator('#tpfOutsideHoursDialog')).toBeVisible();
  await expect(page.locator('#tpfOutsideHoursDialog')).toContainText('10:00');
  const box=await page.locator('#tpfOutsideHoursDialog').boundingBox();expect(box.width).toBeLessThanOrEqual(width);
  await page.getByRole('button',{name:'Cancelar y volver'}).click();await expect.poll(()=>page.evaluate(()=>window.result)).toBe(409);expect(calls).toBe(0);
 }
 await page.evaluate(()=>{window.result=null;fetch('https://overfzbjtpjqxzbujezg.supabase.co/rest/v1/rpc/crm_create_contact_guarded',{method:'POST',headers:{'content-type':'application/json','x-client-info':'test'},body:JSON.stringify({p_welcome:true})}).then(r=>window.result=r.status);});
 await page.getByRole('button',{name:'Sí, enviar ahora'}).click();await expect.poll(()=>page.evaluate(()=>window.result)).toBe(200);expect(calls).toBe(1);expect(choice).toBe('test tpf-outside-hours=now');
});
