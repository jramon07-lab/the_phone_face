const {test,expect}=require('@playwright/test');
test.use({trace:'off',video:'off'});
test.beforeEach(async({page})=>page.setDefaultTimeout(15000));
async function login(page){await page.goto('/');await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);await page.locator('#signin').click();await expect(page.locator('#app')).toBeVisible({timeout:30000});}

test('Plantillas: crear, buscar, favorita, editar, comprobar persistencia y borrar solo la prueba',async({page})=>{
 test.setTimeout(120000);await login(page);const name='Validacion plantilla '+Date.now();
 await page.locator('#tpfWaTemplatesV3Nav').click();await expect(page.locator('#view-wa-templates-v3')).toBeVisible();
 try{
  await page.locator('#tv3New').click();await page.locator('#tv3Name').fill(name);await page.locator('#tv3Category').fill('Validación');await page.locator('#tv3Text').fill('Prueba sin envío. Hola {nombre}.');await page.locator('#tv3Save').click();
  await expect(page.locator('#tv3Search')).toBeVisible({timeout:10000});await page.locator('#tv3Search').pressSequentially(name);await expect(page.locator('#tv3Search')).toHaveValue(name);await expect(page.locator('.tv3Card')).toHaveCount(1);
  await page.locator('.tv3Card [data-fav]').click();await page.locator('#tv3Fav').click();await expect(page.locator('.tv3Card')).toHaveCount(1);await page.locator('#tv3Fav').click();
  await page.locator('.tv3Card [data-edit]').click();await page.locator('#tv3Text').fill('Prueba editada sin envío.');await page.locator('#tv3Save').click();await expect(page.locator('.tv3Card')).toContainText('Prueba editada sin envío.');
  await page.reload();await expect(page.locator('#app')).toBeVisible({timeout:30000});await page.locator('#tpfWaTemplatesV3Nav').click();await page.locator('#tv3Search').fill(name);await expect(page.locator('.tv3Card')).toContainText('Prueba editada sin envío.');
 }finally{
  await page.locator('.nav[data-view="dashboard"]').click();await page.locator('#tpfWaTemplatesV3Nav').click();await page.locator('#tv3Search').fill(name);
  const cards=page.locator('.tv3Card');while(await cards.count()){page.once('dialog',d=>d.accept());await cards.first().locator('[data-delete]').click();await expect(cards).toHaveCount(0);}
 }
});

test('Automatizaciones: crear y editar borrador pausado sin ejecutar acciones',async({page})=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);await login(page);const name='Validacion flujo '+Date.now();let id;
 try{
  await page.locator('.nav[data-view="automations"]').click();await page.locator('#tpfAutoNew').click();await page.locator('[data-presentation="advanced"]').click();
  await page.locator('#tpfFlowName').fill(name);await page.locator('#tpfFlowEnabled').selectOption('0');await page.locator('#tpfFlowTrigger').selectOption('message_contains');await page.locator('[data-trigger-key="keyword"]').fill(name);
  await page.locator('#tpfFlowBuilder [data-add="action"]:visible').first().click();await page.locator('#tpfStepEditor [data-key="action_type"]').selectOption('create_task');await page.locator('#tpfStepEditor [data-cfg="title"]').fill(name+' tarea');
  await page.locator('#tpfStepEditor [data-cfg-bool="notify_in_app"]').uncheck();await page.locator('#tpfFlowSave').click();await expect(page.locator('#tpfFlowMessage')).toContainText('Borrador guardado',{timeout:15000});
  const row=await page.evaluate(async name=>{const r=await sb.from('crm_automations').select('id,enabled,action_config').eq('name',name).single();if(r.error)throw Error(r.error.message);return r.data;},name);id=row.id;expect(row.enabled).toBe(false);expect(row.action_config.steps[0].action_type).toBe('create_task');
  await page.locator('#tpfFlowName').fill(name+' editado');await page.locator('#tpfFlowSave').click();await expect(page.locator('#tpfFlowMessage')).toContainText('Borrador guardado');
  const check=await page.evaluate(async id=>{const a=await sb.from('crm_automations').select('name,enabled').eq('id',id).single();const b=await sb.from('crm_server_automation_jobs').select('id',{count:'exact',head:true}).eq('automation_id',id);if(a.error||b.error)throw Error((a.error||b.error).message);return {...a.data,jobs:b.count};},id);expect(check).toMatchObject({name:name+' editado',enabled:false,jobs:0});
 }finally{
  if(!id)id=await page.evaluate(async name=>{const r=await sb.from('crm_automations').select('id').eq('name',name).maybeSingle();return r.data?.id;},name);
  if(id){page.once('dialog',d=>d.accept());await page.evaluate(id=>window.auto2Delete(id),id);await expect.poll(()=>page.evaluate(async id=>(await sb.from('crm_automations').select('id').eq('id',id)).data.length,id)).toBe(0);}
 }
});

test('Importar Excel: revisar, importar un contacto y retirar solo el registro de prueba',async({page})=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);await login(page);
 const allowed=await page.evaluate(()=>!!(perms?.is_admin||perms?.can_manage_imports));test.skip(!allowed,'La cuenta demo no tiene permiso de importación.');
 const name='Validacion Excel '+Date.now();
 try {
  await page.locator('.nav[data-view="import"]').click();await page.locator('#destination').selectOption('BASE DE DATOS');
  const bytes=await page.evaluate(name=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{Nombre:name,Apellidos:'Demo',Telefono:'',DNI:'',Notas:'Validación aislada sin comunicaciones'}]),'Contactos');return Array.from(new Uint8Array(XLSX.write(book,{bookType:'xlsx',type:'array'})));},name);
  await page.locator('#excelFile').setInputFiles({name:'validacion-crm.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});
  await page.locator('#previewImport').click();await expect(page.locator('#importMapping')).toBeVisible();await expect(page.locator('#importInfo')).toContainText('1 filas');await expect(page.locator('#runImport')).toBeDisabled();
  await page.locator('[data-decision="0"]').selectOption('create');await page.locator('[data-reviewed="0"]').check();await expect(page.locator('#runImport')).toBeEnabled();
  page.once('dialog',d=>d.accept());await page.locator('#runImport').click();await expect(page.locator('#importInfo')).toContainText('Importación terminada',{timeout:30000});
  const rows=await page.evaluate(async name=>(await sb.from('records').select('id,data').eq('data->>NOMBRE',name)).data,name);
  expect(rows).toHaveLength(1);expect(rows[0].data.NOTAS).toBe('Validación aislada sin comunicaciones');
  await page.locator('.nav[data-view="database"]').click();await page.locator('#tpfContactsSearch').fill(name);await expect(page.locator('#tpfContactsRows')).toContainText(name);
 } finally {
  await page.goto('/');await expect(page.locator('#app')).toBeVisible({timeout:30000});
  const own=await page.evaluate(async name=>(await sb.from('records').select('id').eq('data->>NOMBRE',name)).data,name);
  for(const row of own||[]){
   await page.evaluate(id=>window.openContact(id),row.id);page.once('dialog',d=>d.accept());await page.locator('#contactDelete').click();await expect(page.locator('#contactModal')).toBeHidden();
   const copies=await page.evaluate(async id=>(await sb.from('crm_trash').select('id').eq('entity_type','contact').eq('entity_id',id)).data,row.id);
   for(const copy of copies||[]){page.once('dialog',d=>d.accept());await page.evaluate(id=>window.purgeTrash(id),copy.id);}
  }
 }
});

test('Documentos: estado real de Drive y navegación del cliente sin errores',async({page})=>{
 await login(page);
 const result=await page.evaluate(async()=>{const {data}=await sb.auth.getSession();const r=await fetch('/api/crm-documents?action=status',{headers:{Authorization:'Bearer '+data.session.access_token}});return {status:r.status,...await r.json()};});
 expect(result.status).toBe(200);expect(result.ok).toBe(true);console.log('DOCUMENTS_CAPABILITIES',JSON.stringify({connected:result.connected,configured:result.configured,canUpload:result.canUpload,canManage:result.canManage}));
 const contact=await page.evaluate(async()=>{const rows=await TPFRecordLinks.load(sb);const linked=rows.find(r=>r.data?.TPF_DOCUMENTS?.folder_id);return {id:(linked||rows[0])?.id,linked:!!linked};});expect(contact.id).toBeTruthy();
 await page.evaluate(id=>window.openContact(id),contact.id);await page.locator('[data-cp-ref-tab="documentos"]').click();await expect(page.locator('#cpDocumentsPending')).toBeVisible();
 if(result.connected&&contact.linked){await expect(page.locator('#cpDocumentsPending [data-doc-refresh]')).toBeVisible();await page.locator('[data-doc-refresh]').click();await expect(page.locator('#cpDocumentsPending')).not.toHaveAttribute('aria-busy','true');await expect(page.locator('[data-doc-message]')).not.toContainText(/no pudo|no permite|no existe|ha cambiado/i);}
 if(!result.connected)test.info().annotations.push({type:'limitación',description:'Drive no conectado: subida real y creación de carpeta pendientes de autorización de administrador.'});
});

test('Etiquetas: crear, buscar, editar y borrar una etiqueta sin asignarla a clientes',async({page})=>{
 test.setTimeout(120000);await login(page);test.skip(!await page.evaluate(()=>crmCan('can_manage_labels')),'La cuenta demo no permite gestionar etiquetas.');const name='VALIDACION ETIQUETA '+Date.now();
 await page.locator('.nav[data-view="labels"]').click();await expect(page.locator('#lmNew')).toBeVisible();
 try{
  await page.locator('#lmNew').click();await page.locator('#lmName').fill(name);await page.locator('#lmSave').click();await expect(page.locator('#lmModalBack')).toBeHidden({timeout:10000});await page.locator('#lmSearch').pressSequentially(name);await expect(page.locator('#lmSearch')).toHaveValue(name);await expect(page.locator('.lmCard')).toHaveCount(1);
  await page.locator('.lmCard [data-more]').click();await page.locator('.lmCard [data-edit]').click();await page.locator('#lmName').fill(name+' EDITADA');await page.locator('#lmSave').click();await expect(page.locator('#lmModalBack')).toBeHidden();await expect(page.locator('.lmCard')).toContainText(name+' EDITADA');
  const count=await page.evaluate(async name=>{const all=await sb.rpc('crm_list_labels');if(all.error)throw Error(all.error.message);const id=all.data.find(x=>x.name===name)?.id;const r=await sb.from('crm_contact_labels').select('label_id',{count:'exact',head:true}).eq('label_id',id);if(r.error)throw Error(r.error.message);return r.count;},name+' EDITADA');expect(count).toBe(0);
 }catch(error){console.error('LABEL_FAILURE',error.message);throw error;}finally{
  if(await page.locator('#lmModalBack').isVisible())await page.locator('#lmCancel').click();await page.locator('.nav[data-view="dashboard"]').click();await page.locator('.nav[data-view="labels"]').click();await page.locator('#lmSearch').fill(name);const cards=page.locator('.lmCard');
  if(await cards.count()){await cards.first().locator('[data-more]').click();page.once('dialog',d=>d.accept());await cards.first().locator('[data-delete]').click();await expect(cards).toHaveCount(0);}
 }
});


test('Fotos a PDF: recorte, giro, nombre, PDF válido y prevención de doble guardado',async({page})=>{
 await login(page);test.info().annotations.push({type:'alcance',description:'Conversión y formulario reales; receptor de subida aislado, sin escribir en Drive.'});
 await page.evaluate(()=>{window.__pdfValidation=[];TPFDocumentScanner.open({name:'Contacto de validación',folderName:'Carpeta de prueba',check(){},refresh(){},async upload(file){window.__pdfValidation.push({name:file.name,type:file.type,size:file.size,header:await file.slice(0,8).text()});}});});
 const dialog=page.locator('dialog.tpfScan');await expect(dialog).toBeVisible();await dialog.locator('[data-kind]').selectOption('document');
 const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=500;c.height=300;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,500,300);x.fillStyle='#111';x.font='26px sans-serif';x.fillText('DOCUMENTO DE PRUEBA',60,140);return Array.from(Uint8Array.from(atob(c.toDataURL('image/png').split(',')[1]),x=>x.charCodeAt(0)));});
 await dialog.locator('[data-files]').setInputFiles({name:'prueba.png',mimeType:'image/png',buffer:Buffer.from(bytes)});await expect(dialog.locator('[data-rotate]')).toBeEnabled();await dialog.locator('[data-rotate]').click();await dialog.locator('[data-build]').click();
 await expect(dialog.locator('[data-preview]')).toBeVisible();await expect(dialog.locator('[data-images] img')).toHaveCount(1);await dialog.locator('[data-name]').fill('Documento de prueba');await dialog.locator('[data-originals]').uncheck();await dialog.locator('[data-save]').click();
 await expect(dialog.locator('[data-message]')).toContainText('Guardado: 1');await expect(dialog.locator('[data-save]')).toBeDisabled();
 const saved=await page.evaluate(()=>window.__pdfValidation);expect(saved).toHaveLength(1);expect(saved[0]).toMatchObject({name:'Documento de prueba.pdf',type:'application/pdf'});expect(saved[0].header).toContain('%PDF-');expect(saved[0].size).toBeGreaterThan(1000);
 await dialog.locator('[data-close]').first().click();await expect(dialog).toHaveCount(0);
});
