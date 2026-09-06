'use strict';
// Approved by Ramón: PRUEBA organización por clientes - 2026-09-05 / 01 Clientes.
// Never accept an arbitrary creation parent from the browser.
const ROOT='109I6NOTv4PvBCJRapRHA9bSVL80DO_Vs';
const MIME='application/vnd.google-apps.folder',PENDING='TPF_DOCUMENTS_PREPARE';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const stable=value=>JSON.stringify(value,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const publicData=data=>{const copy={...data};delete copy[PENDING];return copy;};
function contactName(data){
 const raw=String(data?.['NOMBRE Y APELLIDOS']||[data?.NOMBRE,data?.APELLIDOS].filter(Boolean).join(' ')||'');
 return raw.replace(/[\x00-\x1f/\\]/g,' ').trim().replace(/\s+/g,' ').toLocaleLowerCase('es').replace(/(^|[\s'-])\p{L}/gu,c=>c.toLocaleUpperCase('es'));
}

module.exports=async function ensureClientFolder({row,who,body,t,record,folder,drive,request,SB,fail,adapter}){
 if(!who.p.is_admin&&!who.p.can_edit_records)throw fail(403,'No tienes permiso para preparar documentos.');
 if(body.confirmed!==true)throw fail(400,'Confirma la preparación de la carpeta.');
 const existing=async current=>{
  const link=current.data.TPF_DOCUMENTS,provider=adapter(link),f=await provider.folder(t,link.folder_id);
  return {ok:true,link,data:current.data,folder:{id:f.id,name:f.name,canUpload:!!f.capabilities?.canAddChildren},created:false};
 };
 if(row.data?.TPF_DOCUMENTS)return existing(row);
 if(!body.expectedData||stable(publicData(body.expectedData))!==stable(publicData(row.data)))throw fail(409,'La ficha cambió. Actualízala antes de preparar la carpeta.');
 const name=contactName(row.data),key=normalize(name);
 if(!key||name.length>180)throw fail(400,'Guarda primero un nombre válido en la ficha del contacto.');
 const root=await folder(t,ROOT);
 async function cas(current,data){
  const q=new URLSearchParams({id:'eq.'+current.id,data:'eq.'+JSON.stringify(current.data)});
  const r=await request(SB+'/rest/v1/records?'+q,{method:'PATCH',headers:{...who.headers,Prefer:'return=representation'},body:JSON.stringify({data})});
  if(!r.ok)throw fail(403,'No se pudo vincular la carpeta a la ficha.');
  const rows=await r.json();return rows.length===1?rows[0]:null;
 }
 async function verifyFolder(id,owned=false){
  const f=await drive(t,'files/'+encodeURIComponent(id)+'?supportsAllDrives=true&fields=id,name,mimeType,trashed,parents,appProperties,capabilities(canAddChildren),webViewLink');
  if(f.trashed||f.mimeType!==MIME||!f.parents?.includes(ROOT)||normalize(f.name)!==key)throw fail(409,'La carpeta cambió de nombre o ubicación. Revisa la vinculación.');
  if(owned&&f.appProperties?.tpfContactId!==row.id)throw fail(409,'No se pudo verificar la carpeta preparada. No se ha vinculado.');
  if(f.appProperties?.tpfContactId&&f.appProperties.tpfContactId!==row.id)throw fail(409,'Esta carpeta pertenece a otro contacto. Revisa la vinculación manualmente.');
  return f;
 }
 async function bind(f,created){
  // Use user-scoped reads and conditional writes, never service-role record writes.
  for(let attempt=0;attempt<3;attempt++){
   const current=await record(row.id,who);
   if(current.data?.TPF_DOCUMENTS)return existing(current);
   if(normalize(contactName(current.data))!==key)throw fail(409,'El nombre del contacto cambió. La carpeta se conserva; revisa la ficha.');
   if(current.data[PENDING]&&current.data[PENDING].folder_id!==f.id)throw fail(409,'Hay otra preparación en curso. Actualiza la ficha.');
   const q=new URLSearchParams({id:'neq.'+row.id,'data->TPF_DOCUMENTS->>folder_id':'eq.'+f.id,select:'id',limit:'1'});
   const r=await request(SB+'/rest/v1/records?'+q,{headers:who.headers});
   if(!r.ok)throw fail(403,'No se pudo comprobar si la carpeta está vinculada.');
   if((await r.json()).length)throw fail(409,'La carpeta ya está vinculada a otro contacto. Revisa la vinculación manualmente.');
   const link={version:1,provider:'google_drive',folder_id:f.id,folder_name:f.name,linked_at:new Date().toISOString(),linked_by:who.p.user_id};
   const data={...publicData(current.data),TPF_DOCUMENTS:link},updated=await cas(current,data);
   if(updated)return {ok:true,link,data:updated.data,folder:{id:f.id,name:f.name,canUpload:!!f.capabilities?.canAddChildren},created};
  }
  throw fail(409,'La ficha está cambiando. La carpeta se conserva; vuelve a intentarlo.');
 }
 let pending=row.data[PENDING];
 if(!pending){
  const matches=new Map(),seenPages=new Set();let page='';
  do{
   const q=new URLSearchParams({q:"'"+ROOT+"' in parents and trashed = false and mimeType = '"+MIME+"'",fields:'nextPageToken,incompleteSearch,files(id,name)',pageSize:'1000',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
   if(page)q.set('pageToken',page);
   const result=await drive(t,'files?'+q);
   if(result.incompleteSearch||!Array.isArray(result.files))throw fail(502,'Google no devolvió todas las carpetas. No se creará ninguna con una búsqueda incompleta.');
   result.files.filter(f=>normalize(f.name)===key).forEach(f=>matches.set(f.id,f));
   page=result.nextPageToken||'';
   if(page&&(seenPages.has(page)||seenPages.size>=30))throw fail(502,'No se pudo completar la búsqueda de carpetas. No se ha creado ninguna.');
   seenPages.add(page);
  }while(page);
  const candidates=[...matches.values()];
  if(body.folderId){
   if(!candidates.some(f=>f.id===body.folderId))throw fail(409,'La carpeta elegida ya no coincide. Vuelve a buscar.');
   return bind(await verifyFolder(body.folderId),false);
  }
  if(candidates.length>1)return {ok:true,needsChoice:true,candidates,root:{id:root.id,name:root.name},contactName:name};
  if(candidates.length===1)return bind(await verifyFolder(candidates[0].id),false);
  if(!root.capabilities?.canAddChildren)throw fail(403,'Google no permite crear carpetas dentro de 01 Clientes.');
  // Reserve the Drive ID in the record first. Parallel requests and retries
  // reuse it, including a timeout after Google actually created the folder.
  const generated=await drive(t,'files/generateIds?count=1&space=drive&type=files');
  const id=generated.ids?.[0];if(!/^[\w-]{10,200}$/.test(id||''))throw fail(502,'Google no pudo preparar la carpeta.');
  pending={version:1,root_id:ROOT,folder_id:id,name,contact_id:row.id};
  const reserved=await cas(row,{...row.data,[PENDING]:pending});
  if(!reserved){
   const current=await record(row.id,who);
   if(current.data?.TPF_DOCUMENTS)return existing(current);
   if(stable(publicData(current.data))!==stable(publicData(row.data)))throw fail(409,'La ficha cambió. Vuelve a intentarlo.');
   pending=current.data[PENDING];
  }
 }
 if(!pending||pending.version!==1||pending.root_id!==ROOT||pending.contact_id!==row.id||normalize(pending.name)!==key||!/^[\w-]{10,200}$/.test(pending.folder_id||''))throw fail(409,'La preparación pendiente necesita revisión. No se ha creado otra carpeta.');
 if(!root.capabilities?.canAddChildren)throw fail(403,'Google no permite preparar la carpeta en 01 Clientes.');
 const result=await request('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({id:pending.folder_id,name:pending.name,mimeType:MIME,parents:[ROOT],appProperties:{tpfContactId:row.id}})});
 if(!result.ok&&result.status!==409)throw fail(502,'No se pudo confirmar la carpeta. Puedes reintentar sin crear otra duplicada.');
 return bind(await verifyFolder(pending.folder_id,true),true);
};
module.exports._test={ROOT,PENDING,normalize,contactName};
