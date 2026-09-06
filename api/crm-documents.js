const crypto=require('crypto');
const SB=String(process.env.SUPABASE_URL||'https://overfzbjtpjqxzbujezg.supabase.co').replace(/\/$/,'');
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const PUBLIC=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'';
const CID=process.env.GOOGLE_DRIVE_CLIENT_ID||'',SECRET=process.env.GOOGLE_DRIVE_CLIENT_SECRET||'',ENC=process.env.CRM_BACKUP_ENCRYPTION_KEY||'';
const ORIGIN=process.env.CRM_DOCUMENTS_ORIGIN||'https://the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app';
const CALLBACK=ORIGIN+'/api/crm-documents?action=callback';
const PROVIDER='google_drive_documents',FOLDER='application/vnd.google-apps.folder';
const UPLOAD_MIMES=new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/rtf','text/plain','image/jpeg','image/png','image/webp','image/heic','image/heif']);
const configured=()=>!!(KEY&&PUBLIC&&CID&&SECRET&&ENC);
const fail=(status,message)=>Object.assign(new Error(message),{status});
const json=(res,status,value)=>res.status(status).json(value);
// JSONB may reorder object keys. Compare all values, not serialization order.
const stableLink=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
async function request(url,options={}){return fetch(url,{...options,signal:AbortSignal.timeout(20000)});}
function seal(value){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update(ENC).digest(),iv),body=Buffer.concat([c.update(JSON.stringify(value)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]).toString('base64url');}
function unseal(value){const b=Buffer.from(value,'base64url'),d=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(ENC).digest(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString());}
const serviceHeaders=()=>({apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'});
async function credential(){const r=await request(SB+'/rest/v1/crm_external_credentials?provider=eq.'+PROVIDER+'&select=encrypted_value',{headers:serviceHeaders()});if(!r.ok)throw fail(503,'No se pudo consultar la conexión de Documentos.');return (await r.json())[0]?.encrypted_value||'';}
async function token(){const stored=await credential();if(!stored)throw fail(409,'Documentos necesita autorización de Google.');const refresh=unseal(stored).refresh_token,r=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CID,client_secret:SECRET,refresh_token:refresh,grant_type:'refresh_token'})}),d=await r.json();if(!r.ok||!d.access_token)throw fail(409,'Vuelve a conectar Google Drive desde Documentos.');return d.access_token;}
async function identity(req){const bearer=String(req.headers.authorization||'');if(!/^Bearer [\w.-]+$/.test(bearer))throw fail(401,'Inicia sesión en el CRM.');const headers={apikey:PUBLIC,Authorization:bearer,'Content-Type':'application/json'},r=await request(SB+'/rest/v1/rpc/current_user_permissions',{method:'POST',headers,body:'{}'});if(!r.ok)throw fail(403,'No se pudo comprobar tu permiso.');const p=await r.json();if(!p?.user_id)throw fail(403,'No tienes acceso.');return {p,headers};}
async function record(id,who){if(!/^[0-9a-f-]{36}$/i.test(String(id)))throw fail(400,'Contacto no válido.');const r=await request(SB+'/rest/v1/records?id=eq.'+id+'&select=id,data,source_sheet',{headers:who.headers});if(!r.ok)throw fail(403,'No tienes acceso a esta ficha.');const row=(await r.json())[0];if(!row)throw fail(404,'No se encontró la ficha.');return row;}
function folderId(value){let s=String(value||'').trim();if(s.startsWith('https://')){let u;try{u=new URL(s);}catch(_){throw fail(400,'Enlace no válido.');}if(u.hostname!=='drive.google.com')throw fail(400,'Pega un enlace de carpeta de Google Drive.');s=u.pathname.match(/\/folders\/([\w-]+)/)?.[1]||'';}if(!/^[\w-]{10,200}$/.test(s))throw fail(400,'Identificador de carpeta no válido.');return s;}
async function drive(t,path,options={}){const r=await request('https://www.googleapis.com/drive/v3/'+path,{...options,headers:{Authorization:'Bearer '+t,...options.headers}});if(!r.ok)throw fail(r.status===404?404:502,r.status===404?'La carpeta no existe o Google no permite acceder a ella.':'Google Drive no pudo completar la operación. Inténtalo más tarde.');return r.json();}
async function folder(t,id){const d=await drive(t,'files/'+folderId(id)+'?supportsAllDrives=true&fields=id,name,mimeType,trashed,parents,capabilities(canAddChildren),webViewLink');if(d.trashed||d.mimeType!==FOLDER)throw fail(400,'Elige una carpeta existente, no un archivo.');return d;}
const adapters={google_drive:{folder,async list(t,id,page){const q=new URLSearchParams({q:"'"+folderId(id)+"' in parents and trashed = false and mimeType != '"+FOLDER+"'",fields:'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)',pageSize:'100',orderBy:'name',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});if(page)q.set('pageToken',String(page));return drive(t,'files?'+q);}}};
function adapter(link){if(!link||link.version!==1)throw fail(409,'Vincula primero una carpeta.');if(!adapters[link.provider])throw fail(409,'Este proveedor todavía no está conectado.');return adapters[link.provider];}
function cookie(req,name){return String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
module.exports=async function(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');const action=String(req.query?.action||'status');try{
 if(action==='callback'){
  if(req.method!=='GET'||!configured())throw fail(503,'La conexión no está preparada.');
  let state;try{state=unseal(req.query?.state);}catch(_){throw fail(400,'La autorización ha caducado. Vuelve a intentarlo.');}
  if(state.exp<Date.now()||state.nonce!==cookie(req,'tpf_docs_nonce'))throw fail(400,'La autorización ha caducado. Vuelve a intentarlo.');
  const p=await request(SB+'/rest/v1/user_permissions?user_id=eq.'+encodeURIComponent(state.userId)+'&select=is_admin',{headers:serviceHeaders()});if(!p.ok||!(await p.json())[0]?.is_admin)throw fail(403,'Solo el administrador puede conectar Documentos.');
  if(req.query?.error||!req.query?.code)throw fail(400,'Google no autorizó la conexión.');
  const r=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CID,client_secret:SECRET,code:String(req.query.code),redirect_uri:CALLBACK,code_verifier:state.verifier,grant_type:'authorization_code'})}),d=await r.json();
  if(!r.ok||!d.refresh_token||!String(d.scope||'').split(' ').includes('https://www.googleapis.com/auth/drive'))throw fail(400,'Google no concedió el acceso necesario. Revisa los permisos y vuelve a conectar.');
  const saved=await request(SB+'/rest/v1/crm_external_credentials?on_conflict=provider',{method:'POST',headers:{...serviceHeaders(),Prefer:'resolution=merge-duplicates'},body:JSON.stringify({provider:PROVIDER,encrypted_value:seal({refresh_token:d.refresh_token}),updated_by:state.userId,updated_at:new Date().toISOString()})});if(!saved.ok)throw fail(503,'No se pudo guardar la autorización.');
  res.setHeader('Set-Cookie','tpf_docs_nonce=; Path=/api/crm-documents; HttpOnly; Secure; SameSite=Lax; Max-Age=0');res.setHeader('Location',ORIGIN+'/?documents=connected');return res.status(303).end();
 }
 const write=['authorize','link','bulkLink','upload','expiry','trash','ensureFolder'].includes(action);if(req.method!==(write?'POST':'GET'))throw fail(405,'Método no permitido.');
 const who=await identity(req),body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(action==='status')return json(res,200,{ok:true,configured:configured(),connected:configured()?!!await credential():false,canManage:!!who.p.is_admin,canUpload:!!(who.p.is_admin||who.p.can_edit_records),callback:who.p.is_admin?CALLBACK:undefined});
 if(!configured())throw fail(503,'Falta configurar la conexión de Documentos en el servidor.');
 if(action==='authorize'){
  if(!who.p.is_admin)throw fail(403,'Solo el administrador puede conectar Documentos.');
  if('https://'+req.headers.host!==ORIGIN)throw fail(409,'Abre el enlace fijo de la rama para conectar Google Drive.');
  const nonce=crypto.randomBytes(24).toString('hex'),verifier=crypto.randomBytes(48).toString('base64url'),state=seal({userId:who.p.user_id,nonce,verifier,exp:Date.now()+600000});
  res.setHeader('Set-Cookie','tpf_docs_nonce='+nonce+'; Path=/api/crm-documents; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
  const q=new URLSearchParams({client_id:CID,redirect_uri:CALLBACK,response_type:'code',scope:'https://www.googleapis.com/auth/drive',access_type:'offline',prompt:'consent',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});return json(res,200,{ok:true,url:'https://accounts.google.com/o/oauth2/v2/auth?'+q});
 }
 if(action==='bulkFolders'){
  if(!who.p.is_admin)throw fail(403,'Solo el administrador puede vincular carpetas en bloque.');
  const t=await token(),root=await folder(t,req.query?.rootId);
  const q=new URLSearchParams({q:"'"+root.id+"' in parents and trashed = false and mimeType = '"+FOLDER+"'",fields:'nextPageToken,files(id,name)',pageSize:'100',orderBy:'name',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
  if(req.query?.page)q.set('pageToken',String(req.query.page));
  return json(res,200,{ok:true,root:{id:root.id,name:root.name},...await drive(t,'files?'+q)});
 }
 const row=await record(body.contactId||req.query?.contactId,who),link=row.data?.TPF_DOCUMENTS;
 if(action==='ensureFolder'){
  if(!who.p.is_admin&&!who.p.can_edit_records)throw fail(403,'No tienes permiso para preparar documentos.');
  const t=await token();
  const result=await require('../lib/crm-document-folder')({row,who,body,t,record,folder,drive,request,SB,fail,adapter});
  return json(res,200,result);
 }
 if(action==='expiry'){
  if(!who.p.is_admin&&!who.p.can_edit_records)throw fail(403,'No tienes permiso para modificar esta ficha.');
  if(body.confirmed!==true||!['contact','holder'].includes(body.person))throw fail(400,'Confirma la fecha y a quién pertenece el DNI.');
  const date=String(body.date||''),parsed=new Date(date+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(parsed)||parsed.toISOString().slice(0,10)!==date||Number(date.slice(0,4))<1900)throw fail(400,'Fecha no válida.');
  if(body.person==='holder'&&row.data?.TPF_TITULAR?.same!==false)throw fail(409,'No hay un titular diferente en esta ficha.');
  const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
  if(stable(body.expectedData)!==stable(row.data))throw fail(409,'La ficha cambió. El PDF se conserva; vuelve a revisar la fecha.');
  const expiry={version:1,...(row.data.TPF_DNI_EXPIRY||{}),[body.person]:{date,subject_name:body.person==='holder'?row.data.TPF_TITULAR.holder_name:(row.data['NOMBRE Y APELLIDOS']||[row.data.NOMBRE,row.data.APELLIDOS].filter(Boolean).join(' ')),subject_dni:body.person==='holder'?row.data.TPF_TITULAR.holder_dni:(row.data.DNI||''),confirmed_at:new Date().toISOString(),confirmed_by:who.p.user_id}};
  const data={...row.data,TPF_DNI_EXPIRY:expiry};
  const q=new URLSearchParams({id:'eq.'+row.id,data:'eq.'+JSON.stringify(row.data)}),r=await request(SB+'/rest/v1/records?'+q,{method:'PATCH',headers:{...who.headers,Prefer:'return=representation'},body:JSON.stringify({data})});
  if(!r.ok)throw fail(403,'No se pudo guardar la fecha.');const updated=await r.json();if(updated.length!==1)throw fail(409,'La ficha cambió; vuelve a revisar la fecha.');return json(res,200,{ok:true,expiry});
 }
 const t=await token();
 if(action==='search'){
  if(!who.p.is_admin)throw fail(403,'Solo el administrador puede buscar y vincular carpetas.');
  const term=String(req.query?.q||'').trim();if(term.length<2||term.length>150)throw fail(400,'Escribe al menos dos caracteres.');
  const q=new URLSearchParams({q:"trashed = false and mimeType = '"+FOLDER+"' and name contains '"+term.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'",fields:'nextPageToken,files(id,name,webViewLink)',pageSize:'30',orderBy:'name',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});return json(res,200,{ok:true,...await drive(t,'files?'+q)});
 }
 if(action==='link'||action==='bulkLink'){
  if(!who.p.is_admin||body.confirmed!==true)throw fail(403,'Confirma la carpeta con una cuenta de administrador.');
  if(stableLink(body.expectedLink||null)!==stableLink(link||null))throw fail(409,'La vinculación ha cambiado. Actualiza la ficha.');
  const f=await folder(t,body.folderId);
  if(action==='bulkLink'){
   if(link)throw fail(409,'La ficha ya tiene una carpeta. Se conserva la vinculación existente.');
   const stable=v=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
   if(stable(body.expectedData)!==stable(row.data))throw fail(409,'Los datos del contacto han cambiado. Revisa de nuevo esta coincidencia.');
   if(!f.parents?.includes(folderId(body.rootId))||f.name!==body.folderName)throw fail(409,'La carpeta cambió de nombre o ubicación. Revisa de nuevo.');
  }
  const newLink={version:1,provider:'google_drive',folder_id:f.id,folder_name:f.name,linked_at:new Date().toISOString(),linked_by:who.p.user_id};
  const data={...row.data,TPF_DOCUMENTS:newLink};
  const q=new URLSearchParams({id:'eq.'+row.id,data:'eq.'+JSON.stringify(row.data)}),r=await request(SB+'/rest/v1/records?'+q,{method:'PATCH',headers:{...who.headers,Prefer:'return=representation'},body:JSON.stringify({data})});if(!r.ok)throw fail(403,'No se pudo guardar la vinculación.');const updated=await r.json();if(updated.length!==1)throw fail(409,'La ficha ha cambiado. Actualízala antes de vincular.');return json(res,200,{ok:true,link:newLink});
 }
 const provider=adapter(link);
 if(action==='list'){const f=await provider.folder(t,link.folder_id);return json(res,200,{ok:true,folder:{id:f.id,name:f.name,canUpload:!!f.capabilities?.canAddChildren},...await provider.list(t,link.folder_id,req.query?.page)});}
 if(action==='trash'){
  if(!who.p.is_admin&&!who.p.can_edit_records)throw fail(403,'No tienes permiso para retirar documentos.');
  if(body.confirmed!==true)throw fail(400,'Confirma el archivo que quieres enviar a la papelera.');
  if(stableLink(body.expectedLink)!==stableLink(link))throw fail(409,'La carpeta ha cambiado. Actualiza los archivos.');
  if(link.provider!=='google_drive')throw fail(409,'Proveedor no disponible.');
  const fileId=folderId(body.fileId),f=await drive(t,'files/'+fileId+'?supportsAllDrives=true&fields=id,name,mimeType,parents,trashed,capabilities(canTrash)');
  if(f.mimeType===FOLDER||!f.parents?.includes(link.folder_id))throw fail(400,'El archivo no pertenece a esta carpeta.');
  if(f.trashed)throw fail(409,'El archivo ya está en la papelera. Actualiza la lista.');
  if(f.name!==body.fileName)throw fail(409,'El archivo cambió de nombre. Revísalo antes de borrarlo.');
  if(!f.capabilities?.canTrash)throw fail(403,'Google no permite enviar este archivo a la papelera.');
  await drive(t,'files/'+fileId+'?supportsAllDrives=true&fields=id,trashed',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});
  return json(res,200,{ok:true});
 }
 if(action==='upload'){
  if(!who.p.is_admin&&!who.p.can_edit_records)throw fail(403,'No tienes permiso para subir documentos.');
  if(stableLink(body.expectedLink)!==stableLink(link))throw fail(409,'La carpeta ha cambiado. Actualiza antes de subir.');
  const f=await provider.folder(t,link.folder_id);if(!f.capabilities?.canAddChildren)throw fail(403,'Google no permite subir archivos a esta carpeta.');
  const name=String(body.name||'').trim(),size=Number(body.size),mime=String(body.mimeType||'');
  if(!name||name.length>200||/[\x00-\x1f/\\]/.test(name)||!Number.isSafeInteger(size)||size<=0||size>100*1024*1024||!UPLOAD_MIMES.has(mime))throw fail(400,'Elige un documento o una fotografía de hasta 100 MB.');
  const r=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,webViewLink',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json','X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(size),Origin:ORIGIN},body:JSON.stringify({name,mimeType:mime,parents:[f.id]})});const url=r.headers.get('location');if(!r.ok||!url||new URL(url).origin!=='https://www.googleapis.com')throw fail(502,'Google no pudo preparar la subida.');return json(res,200,{ok:true,uploadUrl:url});
 }
 throw fail(400,'Acción no disponible.');
 }catch(e){const status=e.status||500;return json(res,status,{ok:false,error:status===500?'No se pudo completar la operación. Vuelve a intentarlo.':e.message});}
};
module.exports._test={folderId,adapter,seal,unseal};
