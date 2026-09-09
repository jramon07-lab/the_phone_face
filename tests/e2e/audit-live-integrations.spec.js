const {test,expect}=require('@playwright/test');
const {hash}=require('node:crypto');
test.use({trace:'off',video:'off',screenshot:'off'});
const CHAT='000009092026001@c.us';
async function login(page){await page.goto('/');await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);await page.locator('#signin').click();await expect(page.locator('#app')).toBeVisible({timeout:30000});}
test.beforeAll(async({request})=>{
 if(process.env.E2E_EXPECTED_COMMIT)await expect.poll(async()=>{const r=await request.get('/api/health');return (await r.json()).commit},{timeout:120000,intervals:[5000]}).toBe(process.env.E2E_EXPECTED_COMMIT);
});
async function archiveRow(page){return page.evaluate(async chat=>{const r=await sb.from('crm_whatsapp_chat_state').select('chat_id,archived').eq('chat_id',chat).maybeSingle();if(r.error)throw Error(r.error.message);return r.data;},CHAT)}

test('Archivo real: dos sesiones comparten el cambio persistido y su recuperación',async({browser},info)=>{
 test.setTimeout(150000);const devices=[];const stamp=Math.floor(Date.now()/1000)-60;
 try{
  for(let i=0;i<2;i++){
   const context=await browser.newContext({baseURL:info.project.use.baseURL,extraHTTPHeaders:info.project.use.extraHTTPHeaders});const page=await context.newPage();devices.push({context,page});
   await context.route('**/rest/v1/**',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(['GET','HEAD','OPTIONS'].includes(req.method()))return route.continue();
    if(u.pathname.endsWith('/crm_whatsapp_chat_state')){expect(req.postDataJSON().chat_id).toBe(CHAT);return route.continue();}
    const rpc=u.pathname.split('/rpc/')[1]||'';
    if(/^(crm_get_|wa_get_|crm_can|current_user_|search_records|contact_related_items|crm_list_|wa_list_)/.test(rpc))return route.continue();
    return route.fulfill({json:[]});
   });
   await context.route('**/api/green-read-safe',route=>route.fulfill({json:{ok:true,setRead:false}}));
   await context.route('**/api/green?**',route=>{
    const action=new URL(route.request().url()).searchParams.get('action');
    const message={chatId:CHAT,idMessage:'audit-only',timestamp:stamp,type:'outgoing',textMessage:'Conversación sintética de auditoría'};
    const chat={id:CHAT,name:'Auditoría archivo',unreadCount:0,_lastMessage:message,_lastOutgoingAt:stamp};
    const payload=action==='state'?{state:'authorized'}:['summary','chats'].includes(action)?{chats:[chat]}:action==='history'?{messages:[message]}:action==='avatar'?{urlAvatar:''}:{notifications:[],previews:[],changed:false,setRead:false};
    return route.fulfill({json:{ok:true,...payload}});
   });
  }
  await Promise.all(devices.map(d=>login(d.page)));
  expect(await archiveRow(devices[0].page),'Retirar la fila de una auditoría anterior antes de repetir').toBeNull();
  for(const d of devices){await d.page.locator('.nav[data-view="whatsapplive"]').click();await expect(d.page.locator('#waLiveChats .waChatRow')).toBeVisible();await d.page.evaluate(chat=>window.selectWhatsAppChat(chat),CHAT);await expect(d.page.locator('#waArchiveChat')).toContainText('Archivar conversación');}
  await devices[0].page.locator('#waArchiveChat').click();await expect.poll(()=>archiveRow(devices[0].page)).toEqual({chat_id:CHAT,archived:true});
  await expect(devices[1].page.locator('#waArchiveChat')).toContainText('Desarchivar',{timeout:35000});
  await devices[1].page.locator('#waArchiveChat').click();await expect.poll(()=>archiveRow(devices[1].page)).toEqual({chat_id:CHAT,archived:false});
  await expect(devices[0].page.locator('#waArchiveChat')).toContainText('Archivar conversación',{timeout:35000});
  await devices[0].page.reload();await expect(devices[0].page.locator('#app')).toBeVisible({timeout:30000});
  expect(await archiveRow(devices[0].page)).toEqual({chat_id:CHAT,archived:false});
  console.log('LIVE_ARCHIVE_VERIFIED',JSON.stringify({chat_id:CHAT,realDatabase:true,realProvider:false,devices:2,archived:false,cleanup:'Remove this exact synthetic row after both browser contexts close'}));
 }finally{for(const d of devices)await d.context.close();}
});

function pdfBytes(text){
 const content='BT /F1 14 Tf 40 740 Td ('+text+') Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(content)+' >>\nstream\n'+content+'\nendstream'];
 let out='%PDF-1.4\n';const offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(out));out+=(i+1)+' 0 obj\n'+obj+'\nendobj\n'});const xref=Buffer.byteLength(out);out+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return Buffer.from(out);
}

test('Drive real: crear carpeta, subir PDF, listar y enviar otra copia a papelera',async({page})=>{
 test.setTimeout(180000);await login(page);const marker='Auditoria Integracion '+(process.env.E2E_AUDIT_ID||Date.now());let id,folder,file;
 const ownRows=()=>page.evaluate(async marker=>{const r=await sb.from('records').select('id,data').ilike('data->>NOMBRE Y APELLIDOS','%'+marker+'%');if(r.error)throw Error(r.error.message);return r.data;},marker);
 try{
  await page.locator('.nav[data-view="database"]').click();await page.locator('#tpfContactsAdd').click();await page.locator('#tpfCreateFirst').fill(marker);await page.locator('#tpfCreateLast').fill('Prueba');
  await expect(page.locator('#tpfCreatePhone')).toHaveValue('');await expect(page.locator('#tpfCreateEmail')).toHaveValue('');
  if(await page.locator('#tpfCreateWelcome').count())await expect(page.locator('#tpfCreateWelcome')).not.toBeChecked();
  await page.locator('#tpfContactsCreateSave').click();await expect(page.locator('#tpfContactsCreateBack')).toBeHidden({timeout:15000});
  const rows=await ownRows();expect(rows).toHaveLength(1);id=rows[0].id;
  await page.evaluate(id=>window.openContact(id),id);await page.locator('[data-cp-ref-tab="documentos"]').click();await page.locator('[data-doc-ensure]').click();
  // The success message is transient: loadFiles immediately replaces it.
  // Verify the persisted relation and the final visible folder/upload state.
  await expect.poll(async()=> (await ownRows())[0]?.data?.TPF_DOCUMENTS?.folder_id,{timeout:60000}).toBeTruthy();folder=(await ownRows())[0].data.TPF_DOCUMENTS;
  await expect(page.locator('#cpDocumentsPending a[href="https://drive.google.com/drive/folders/'+folder.folder_id+'"]')).toBeVisible();
  await expect(page.locator('[data-doc-upload]')).toBeEnabled({timeout:20000});
  const bytes=pdfBytes('CRM integration audit - synthetic data only');
  const upload=async name=>{await page.locator('[data-doc-file]').setInputFiles({name,mimeType:'application/pdf',buffer:bytes});await expect(page.locator('[data-doc-message]')).toContainText('1 archivo(s) subido(s)',{timeout:30000});await page.locator('[data-doc-refresh]').click();await expect(page.locator('.tpfDocsFile').filter({hasText:name})).toBeVisible({timeout:15000});};
  await upload(marker+'.pdf');file=await page.locator('.tpfDocsFile').filter({hasText:marker+'.pdf'}).locator('[data-doc-trash]').getAttribute('data-doc-trash');
  await upload(marker+' retirar.pdf');const removed=page.locator('.tpfDocsFile').filter({hasText:marker+' retirar.pdf'}),removedId=await removed.locator('[data-doc-trash]').getAttribute('data-doc-trash');
  page.once('dialog',d=>d.accept());await removed.locator('[data-doc-trash]').click();await expect(removed).toHaveCount(0);
  console.log('LIVE_DRIVE_VERIFIED',JSON.stringify({contact_id:id,folder_id:folder.folder_id,folder_name:folder.folder_name,file_id:file,trashed_file_id:removedId,file_name:marker+'.pdf',bytes:bytes.length,sha256:hash('sha256',bytes),cleanup:'Fetch the retained synthetic PDF independently and compare SHA256; retain Drive artifacts pending explicit cleanup permission'}));
 }finally{
  console.log('LIVE_DRIVE_CLEANUP_IDS',JSON.stringify({marker,contact_id:id,folder_id:folder?.folder_id,file_id:file}));
  for(const row of await ownRows()){
   await page.evaluate(id=>window.openContact(id),row.id);page.once('dialog',d=>d.accept());await page.locator('#contactDelete').click();await expect(page.locator('#contactModal')).toBeHidden();
   const trash=await page.evaluate(async id=>{const r=await sb.from('crm_trash').select('id').eq('entity_type','contact').eq('entity_id',id);if(r.error)throw Error(r.error.message);return r.data;},row.id);
   for(const entry of trash){page.once('dialog',d=>d.accept());await page.evaluate(id=>window.purgeTrash(id),entry.id);}
  }
  expect(await ownRows()).toHaveLength(0);
 }
});
