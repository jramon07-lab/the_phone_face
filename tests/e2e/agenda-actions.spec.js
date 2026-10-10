const fs=require('node:fs'),path=require('node:path');
const {test,expect}=require('@playwright/test');
const root=process.cwd();
async function fixture(page){
  await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.join(root,u.pathname);if(u.hostname==='fixture.invalid'&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.abort();});
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>','<head><base href="http://fixture.invalid/">');
  await page.setContent(html);
  await page.evaluate(()=>{
    window.$=id=>document.getElementById(id);window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.perms={is_admin:true};window.crmCan=()=>true;
    $('login').classList.add('hidden');$('app').classList.remove('hidden');document.querySelectorAll('main>section').forEach(x=>x.classList.add('hidden'));$('view-agenda').classList.remove('hidden');
    window.TPFModules={register:(n,m)=>m.install()};window.TPFRecordLinks={invalidate(){}};window.calls=[];window.mutations=[];window.errors=[];
    window.alert=v=>errors.push(String(v));window.confirm=()=>true;
    window.tpfSetSaving=(b,m)=>{b.disabled=true;};window.tpfResetSaving=(b,m)=>{b.disabled=false;};window.tpfShowSaveError=(b,m,e)=>{b.disabled=false;m.textContent=e.message;};window.selectedAgendaReminderMinutes=()=>[];
    window.openWaQuick=opts=>calls.push(['message',opts]);window.selectWhatsAppChat=async id=>calls.push(['conversation',id]);window.tpfCaptureCurrentScreen=()=>({});window.tpfRestoreCapturedScreen=async()=>{};window.openOpportunityFull=async id=>calls.push(['opportunity',id]);
    document.querySelector('.nav[data-view="whatsapplive"]').onclick=()=>calls.push(['nav']);
    const yesterday=new Date(Date.now()-86400000).toISOString();window.fixtureRows=['task','cancel','delete'].map(id=>({id,title:'Revisar '+id,starts_at:yesterday,status:'pending',agenda_type:'Tarea',whatsapp_enabled:false,customer_name:'Ana Ejemplo',customer_phone:'600123456',related_record_id:'r1',agenda_meta:{opportunity_id:'o1'}}));
    window.sb={auth:{getUser:async()=>({data:{user:{id:'fixture-user'}}})},rpc:async()=>({data:[]}),from(table){let predicates=[],patch=null,remove=false;const q={select(){return q},update(v){patch=v;return q},delete(){remove=true;return q},or(){return q},order(){return q},limit(){return q},range(){return q},in(k,v){predicates.push(r=>v.includes(r[k]));return q},eq(k,v){predicates.push(r=>r[k]===v);return q},lt(k,v){predicates.push(r=>r[k]<v);return q},gte(k,v){predicates.push(r=>r[k]>=v);return q},single:async()=>{const r=await execute();return {...r,data:r.data?.[0]||null}},maybeSingle:async()=>({data:null}),then(resolve,reject){return execute().then(resolve,reject)}};
      async function execute(){if(table==='records')return {data:[{id:'r1',source_sheet:'BASE DE DATOS',data:{NOMBRE:'Ana',APELLIDOS:'Ejemplo',TELEFONO:'600123456'}}]};if(table!=='agenda_items')return {data:[]};const matches=fixtureRows.filter(r=>predicates.every(p=>p(r)));if(window.failMutation&&(patch||remove))throw Error('Conexión interrumpida');if(patch){mutations.push({patch,ids:matches.map(r=>r.id)});matches.forEach(r=>Object.assign(r,patch));}if(remove){mutations.push({delete:matches.map(r=>r.id)});window.fixtureRows=fixtureRows.filter(r=>!matches.includes(r));}return {data:matches.map(r=>({...r}))};}return q;}};
  });
  for(const name of ['task-model','agenda-core','agenda-detail-pro','agenda-clean-workspace','linked-contact-actions'])await page.addScriptTag({path:path.join(root,'js/modules',name+'.js')});
  await page.evaluate(()=>loadAgenda());
}
test('All agenda row buttons route after the detail enhancement is installed',async({page})=>{
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));await fixture(page);
  const row=page.locator('.agendaItem').filter({has:page.locator('[data-open-agenda="task"]')});
  await row.getByRole('button',{name:'Escribir WhatsApp',exact:true}).click();await expect.poll(()=>page.evaluate(()=>calls.filter(c=>c[0]==='message').length)).toBe(1);
  expect(await page.evaluate(()=>calls.find(c=>c[0]==='message')[1])).toEqual({phone:'34600123456',name:'Ana Ejemplo',contactId:'r1'});
  await row.getByRole('button',{name:'Ir a conversación',exact:true}).click();await expect.poll(()=>page.evaluate(()=>calls.filter(c=>c[0]==='conversation').length)).toBe(1);
  expect(await page.evaluate(()=>calls.find(c=>c[0]==='conversation')[1])).toBe('34600123456@c.us');
  await row.getByRole('button',{name:'Ver oportunidad',exact:true}).click();expect(await page.evaluate(()=>calls.filter(c=>c[0]==='opportunity'))).toEqual([['opportunity','o1']]);
  expect(await page.evaluate(()=>mutations)).toEqual([]);
  await row.getByRole('button',{name:'Posponer',exact:true}).click();await expect(page.locator('#agendaCreateCard')).toHaveClass(/open/);await expect(page.locator('#agendaTitle')).toHaveValue('Revisar task');
  await page.locator('#agendaStarts').fill('2026-12-10T10:30');await page.locator('#agendaSave').click();await expect(page.locator('#agendaCreateCard')).not.toHaveClass(/open/);
  expect(await page.evaluate(()=>fixtureRows.find(r=>r.id==='task').starts_at)).toContain('2026-12-10');
  await row.getByRole('button',{name:'Más acciones'}).click();await page.locator('[data-agenda-edit]').click();await expect(page.locator('#agendaCreateCard')).toHaveClass(/open/);await page.locator('#agendaTitle').fill('Asunto corregido');await page.locator('#agendaSave').click();await expect(page.locator('#agendaCreateCard')).not.toHaveClass(/open/);await expect(row).toContainText('Asunto corregido');
  await row.getByRole('button',{name:'Completar'}).click();await expect(page.locator('[data-open-agenda="task"]')).toHaveCount(0);expect(await page.evaluate(()=>fixtureRows.find(r=>r.id==='task').status)).toBe('completed');
  await page.locator('[data-more-agenda="cancel"]').click();await page.locator('[data-agenda-cancel]').click();await expect(page.locator('[data-open-agenda="cancel"]')).toHaveCount(0);expect(await page.evaluate(()=>fixtureRows.find(r=>r.id==='cancel').status)).toBe('cancelled');
  await page.locator('[data-more-agenda="delete"]').click();await page.locator('[data-agenda-delete]').click();await expect(page.locator('[data-open-agenda="delete"]')).toHaveCount(0);expect(await page.evaluate(()=>fixtureRows.some(r=>r.id==='delete'))).toBe(false);
  expect(await page.evaluate(()=>errors)).toEqual([]);expect(pageErrors).toEqual([]);
});
test('A failed task action shows the error instead of silently doing nothing',async({page})=>{
  await fixture(page);await page.evaluate(()=>{window.failMutation=true});await page.locator('[data-complete-agenda="task"]').click();await expect.poll(()=>page.evaluate(()=>errors)).toEqual(['Conexión interrumpida']);expect(await page.evaluate(()=>fixtureRows.find(r=>r.id==='task').status)).toBe('pending');
});
