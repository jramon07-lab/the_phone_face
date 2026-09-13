const crypto=require('crypto');

const SB=String(process.env.SUPABASE_URL||'https://overfzbjtpjqxzbujezg.supabase.co').replace(/\/$/,'');
const SERVICE=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const DEFAULT_PUBLIC='sb_publishable_o6_eM5v04EBInhfiSnyFLA_5yRHlB4j';
const PUBLIC=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||DEFAULT_PUBLIC;
const CLIENT_ID=process.env.GOOGLE_CONTACTS_CLIENT_ID||process.env.GOOGLE_DRIVE_CLIENT_ID||'';
const CLIENT_SECRET=process.env.GOOGLE_CONTACTS_CLIENT_SECRET||process.env.GOOGLE_DRIVE_CLIENT_SECRET||'';
const ENCRYPTION_KEY=process.env.CRM_BACKUP_ENCRYPTION_KEY||'';
const ORIGIN=(process.env.CRM_GOOGLE_CONTACTS_ORIGIN||'https://the-phone-face-app-whatsapp-fotos-y.vercel.app').replace(/\/$/,'');
const CALLBACK=ORIGIN+'/api/google-contacts-callback';
const PROVIDER='google_contacts_shared';
const SCOPE='https://www.googleapis.com/auth/contacts openid email';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const configured=()=>!!(SERVICE&&PUBLIC&&CLIENT_ID&&CLIENT_SECRET&&ENCRYPTION_KEY);
const serviceHeaders=()=>({apikey:SERVICE,Authorization:'Bearer '+SERVICE,'Content-Type':'application/json'});
const json=(res,status,value)=>res.status(status).json(value);

async function request(url,options={}){return fetch(url,{...options,signal:AbortSignal.timeout(20000)});}
function seal(value){const iv=crypto.randomBytes(12),key=crypto.createHash('sha256').update(ENCRYPTION_KEY).digest(),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');}
function unseal(value){const raw=Buffer.from(value,'base64url'),key=crypto.createHash('sha256').update(ENCRYPTION_KEY).digest(),decipher=crypto.createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAuthTag(raw.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString());}
function cookie(req,name){return String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
async function identity(req){
 const bearer=String(req.headers.authorization||'');
 if(!/^Bearer [\w.-]+$/.test(bearer))throw fail(401,'Inicia sesión en el CRM.');
 let user=null,publicKey='';
 for(const key of [...new Set([PUBLIC,DEFAULT_PUBLIC].filter(Boolean))]){
  const auth=await request(SB+'/auth/v1/user',{headers:{apikey:key,Authorization:bearer}});
  if(auth.ok){user=await auth.json();publicKey=key;break;}
 }
 if(!user?.id)throw fail(401,'La sesión ha caducado. Vuelve a entrar en el CRM.');
 const permission=await request(SB+'/rest/v1/user_permissions?user_id=eq.'+encodeURIComponent(user.id)+'&select=*',{headers:serviceHeaders()});
 if(!permission.ok)throw fail(503,'No se pudo comprobar tu permiso.');
 const permissions=(await permission.json())?.[0];
 if(!permissions?.user_id)throw fail(403,'No tienes acceso.');
 return {permissions,headers:{apikey:publicKey,Authorization:bearer,'Content-Type':'application/json'}};
}
async function storedCredential(){const r=await request(SB+'/rest/v1/crm_external_credentials?provider=eq.'+PROVIDER+'&select=encrypted_value',{headers:serviceHeaders()});if(!r.ok)throw fail(503,'No se pudo consultar la conexión de Google Contacts.');const encrypted=(await r.json())[0]?.encrypted_value;return encrypted?unseal(encrypted):null;}
async function accessToken(){const stored=await storedCredential();if(!stored?.refresh_token)throw fail(409,'Google Contacts no está conectado.');const r=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,refresh_token:stored.refresh_token,grant_type:'refresh_token'})}),data=await r.json();if(!r.ok||!data.access_token)throw fail(409,'Google ha caducado o retirado el permiso. Vuelve a conectar Google Contacts.');return {token:data.access_token,stored};}
function validatePeoplePath(value){const raw=String(value||'');if(!raw||raw.length>1800||raw.includes('://')||raw.includes('..'))throw fail(400,'Petición de Google no válida.');const [pathname]=raw.split('?');const allowed=pathname==='people:searchContacts'||pathname==='people/me/connections'||pathname==='people:createContact'||/^people\/c[\w-]+(?::(?:updateContact|deleteContact))?$/.test(pathname);if(!allowed)throw fail(400,'Operación de Google Contacts no permitida.');return raw;}
function cleanPhone(value){let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);if(digits.startsWith('34')&&digits.length===11)digits=digits.slice(2);return digits.slice(-9);}
function recordPhone(data){for(const key of ['TELÉFONO','TELEFONO','PHONE','MOVIL'])if(data&&data[key])return cleanPhone(data[key]);return '';}
function recordGoogleBinding(data){const value=data?.TPF_GOOGLE_CONTACT||{};return String(value.resource_name||value.resourceName||data?.TPF_GOOGLE_CONTACT_RESOURCE||'').trim();}
function recordGoogleAccount(data){const value=data?.TPF_GOOGLE_CONTACT||{};return String(value.google_account||value.account||data?.TPF_GOOGLE_CONTACT_ACCOUNT||'').trim().toLowerCase();}
function cleanChatId(value){const raw=String(value||'').trim();if(!raw||raw.length>100)return '';const digits=raw.replace(/\D/g,'');return digits?digits+'@c.us':'';}
function validGoogleResource(value){return /^people\/c[\w-]+$/.test(String(value||''));}
async function photoRecord(recordId,chatId){
 const id=String(recordId||'').trim();if(!/^[\w-]{8,80}$/.test(id))throw fail(400,'Ficha CRM no válida.');
 const result=await request(SB+'/rest/v1/records?id=eq.'+encodeURIComponent(id)+'&select=id,data',{headers:serviceHeaders()});
 if(!result.ok)throw fail(503,'No se pudo comprobar la ficha CRM.');const row=(await result.json())[0];if(!row?.id||!row?.data)throw fail(404,'La ficha CRM ya no existe.');
 const data=row.data,phone=recordPhone(data),savedChat=cleanChatId(data.TPF_WHATSAPP_CHAT_ID),requestedChat=cleanChatId(chatId);
 const resource=recordGoogleBinding(data);
 if(!phone||!savedChat||!requestedChat||cleanPhone(savedChat)!==phone||cleanPhone(requestedChat)!==phone)throw fail(409,'La foto no se actualizará: WhatsApp no está vinculado de forma exacta a esta ficha.');
 if(!validGoogleResource(resource))throw fail(409,'La foto no se actualizará: falta la vinculación exacta con Google.');
 return {row,data,phone,chatId:savedChat,resource};
}
async function whatsappAvatar(chatId){
 const id=process.env.GREEN_API_INSTANCE_ID||process.env.GREEN_API_ID_INSTANCE||process.env.GREEN_API_IDINSTANCE||'';
 const token=process.env.GREEN_API_TOKEN||process.env.GREEN_API_API_TOKEN||process.env.GREEN_API_TOKEN_INSTANCE||'';
 const base=String(process.env.GREEN_API_API_URL||'https://7107.api.greenapi.com').replace(/\/$/,'');
 if(!id||!token)throw fail(503,'GREEN-API no está disponible para consultar la foto.');
 const response=await request(base+'/waInstance'+encodeURIComponent(id)+'/getAvatar/'+encodeURIComponent(token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId})});
 const value=await response.json().catch(()=>({}));if(!response.ok)throw fail(502,'WhatsApp no pudo devolver la foto.');
 let bytes;
 const base64=String(value?.base64Avatar||'').replace(/^data:image\/[a-z0-9.+-]+;base64,/i,'').trim();
 if(base64){try{bytes=Buffer.from(base64,'base64');}catch(_){bytes=null;}}
 if(!bytes?.length&&value?.urlAvatar){
   let url;try{url=new URL(String(value.urlAvatar));}catch(_){throw fail(502,'WhatsApp devolvió una dirección de foto no válida.');}
   if(url.protocol!=='https:')throw fail(502,'WhatsApp devolvió una foto no segura.');
   const image=await request(url.toString());if(!image.ok)throw fail(502,'No se pudo descargar la foto de WhatsApp.');
   const length=Number(image.headers.get('content-length')||0);if(length>5*1024*1024)throw fail(413,'La foto de WhatsApp es demasiado grande.');
   bytes=Buffer.from(await image.arrayBuffer());
 }
 if(!bytes?.length)throw fail(404,'WhatsApp no tiene una foto disponible para este contacto.');
 if(bytes.length>5*1024*1024)throw fail(413,'La foto de WhatsApp es demasiado grande.');
 const type=bytes.subarray(0,12);const imageLike=(type[0]===0xff&&type[1]===0xd8)||(type[0]===0x89&&type[1]===0x50)||(type.toString('ascii',0,4)==='RIFF');
 if(!imageLike)throw fail(502,'La imagen recibida de WhatsApp no es válida.');
 return {bytes,hash:crypto.createHash('sha256').update(bytes).digest('hex')};
}
async function savePhotoFingerprint(item,hash){
 const current=item.data||{},next={...current,TPF_WHATSAPP_GOOGLE_PHOTO:{version:1,hash,chat_id:item.chatId,resource_name:item.resource,synced_at:new Date().toISOString()}};
 const saved=await request(SB+'/rest/v1/records?id=eq.'+encodeURIComponent(item.row.id),{method:'PATCH',headers:{...serviceHeaders(),Prefer:'return=representation'},body:JSON.stringify({data:next})});
 if(!saved.ok)throw fail(503,'Google actualizó la foto, pero el CRM no pudo guardar su comprobación. No repitas todavía.');
}
async function assertPhotoAccount(data){const stored=await storedCredential(),expected=recordGoogleAccount(data),actual=String(stored?.email||'').trim().toLowerCase();if(!stored?.refresh_token)throw fail(409,'Google Contacts no está conectado.');if(expected&&actual&&expected!==actual)throw fail(409,'La ficha está vinculada a otra cuenta de Google. No se actualizará su foto.');}

module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 const action=String(req.query?.action||'status');
 try{
  if(action==='callback'){
   if(req.method!=='GET'||!configured())throw fail(503,'La conexión de Google Contacts no está preparada.');
   let state;try{state=unseal(req.query?.state);}catch(_){throw fail(400,'La autorización ha caducado. Vuelve a intentarlo.');}
   if(state.exp<Date.now()||state.nonce!==cookie(req,'tpf_google_contacts_nonce'))throw fail(400,'La autorización ha caducado. Vuelve a intentarlo.');
   const permission=await request(SB+'/rest/v1/user_permissions?user_id=eq.'+encodeURIComponent(state.userId)+'&select=is_admin',{headers:serviceHeaders()});
   if(!permission.ok||!(await permission.json())[0]?.is_admin)throw fail(403,'Solo el administrador puede conectar Google Contacts.');
   if(req.query?.error||!req.query?.code)throw fail(400,'Google no autorizó la conexión.');
   const tokenResponse=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,code:String(req.query.code),redirect_uri:CALLBACK,code_verifier:state.verifier,grant_type:'authorization_code'})}),tokens=await tokenResponse.json();
   if(!tokenResponse.ok||!tokens.refresh_token||!String(tokens.scope||'').split(' ').includes('https://www.googleapis.com/auth/contacts'))throw fail(400,'Google no concedió el acceso necesario. Revisa los permisos y vuelve a conectar.');
   let email='';const info=await request('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token}});if(info.ok)email=String((await info.json()).email||'').trim();
   const saved=await request(SB+'/rest/v1/crm_external_credentials?on_conflict=provider',{method:'POST',headers:{...serviceHeaders(),Prefer:'resolution=merge-duplicates'},body:JSON.stringify({provider:PROVIDER,encrypted_value:seal({refresh_token:tokens.refresh_token,email}),updated_by:state.userId,updated_at:new Date().toISOString()})});
   if(!saved.ok)throw fail(503,'No se pudo guardar la autorización común.');
   res.setHeader('Set-Cookie','tpf_google_contacts_nonce=; Path=/api/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');res.setHeader('Location',ORIGIN+'/?googleContacts=connected');return res.status(303).end();
  }
  const who=await identity(req);
  if(action==='status'){
   if(req.method!=='GET')throw fail(405,'Método no permitido.');const stored=configured()?await storedCredential():null;
   return json(res,200,{ok:true,configured:configured(),connected:!!stored?.refresh_token,email:stored?.email||'',canManage:!!who.permissions.is_admin,callback:who.permissions.is_admin?CALLBACK:undefined});
  }
  if(!configured())throw fail(503,'Falta configurar Google Contacts en el servidor.');
  if(action==='authorize'){
   if(req.method!=='POST')throw fail(405,'Método no permitido.');if(!who.permissions.is_admin)throw fail(403,'Solo el administrador puede conectar Google Contacts.');
   if('https://'+String(req.headers.host||'').toLowerCase()!==ORIGIN)throw fail(409,'Abre la dirección estable del CRM para conectar Google Contacts.');
   const nonce=crypto.randomBytes(24).toString('hex'),verifier=crypto.randomBytes(48).toString('base64url'),state=seal({userId:who.permissions.user_id,nonce,verifier,exp:Date.now()+600000});
   res.setHeader('Set-Cookie','tpf_google_contacts_nonce='+nonce+'; Path=/api/; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
   const q=new URLSearchParams({client_id:CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent select_account',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
   return json(res,200,{ok:true,url:'https://accounts.google.com/o/oauth2/v2/auth?'+q});
  }
  if(action==='disconnect'){
   if(req.method!=='POST')throw fail(405,'Método no permitido.');if(!who.permissions.is_admin)throw fail(403,'Solo el administrador puede desconectar Google Contacts.');
   const removed=await request(SB+'/rest/v1/crm_external_credentials?provider=eq.'+PROVIDER,{method:'DELETE',headers:serviceHeaders()});if(!removed.ok)throw fail(503,'No se pudo desconectar Google Contacts.');return json(res,200,{ok:true});
  }
  if(action==='photo-preview'){
   if(req.method!=='POST')throw fail(405,'Método no permitido.');
   const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
   const item=await photoRecord(body.recordId,body.chatId);await assertPhotoAccount(item.data);const avatar=await whatsappAvatar(item.chatId),previous=String(item.data?.TPF_WHATSAPP_GOOGLE_PHOTO?.hash||'');
   return json(res,200,{ok:true,recordId:item.row.id,ready:previous!==avatar.hash,hash:avatar.hash,reason:previous===avatar.hash?'La foto ya está sincronizada.':'Foto de WhatsApp disponible para actualizar.'});
  }
  if(action==='sync-whatsapp-photo'){
   if(req.method!=='POST')throw fail(405,'Método no permitido.');
   if(!(who.permissions.is_admin||who.permissions.can_edit_records||who.permissions.can_create_database))throw fail(403,'No tienes permiso para actualizar contactos.');
   const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{},item=await photoRecord(body.recordId,body.chatId);await assertPhotoAccount(item.data);const avatar=await whatsappAvatar(item.chatId);
   if(!/^[a-f0-9]{64}$/i.test(String(body.expectedHash||''))||String(body.expectedHash)!==avatar.hash)throw fail(409,'La foto ha cambiado desde la vista previa. Vuelve a comprobar antes de actualizar.');
   const {token}=await accessToken();
   const google=await request('https://people.googleapis.com/v1/'+item.resource+':updateContactPhoto',{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({photoBytes:avatar.bytes.toString('base64'),personFields:'photos'})});
   const text=await google.text();let data={};try{data=text?JSON.parse(text):{};}catch(_){data={};}
   if(!google.ok)throw fail(google.status===401?409:502,data?.error?.message||'Google Contacts no pudo actualizar la foto.');
   await savePhotoFingerprint(item,avatar.hash);
   return json(res,200,{ok:true,recordId:item.row.id,updated:true,hash:avatar.hash});
  }
  if(action==='proxy'){
   if(req.method!=='POST')throw fail(405,'Método no permitido.');const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{},method=String(body.method||'GET').toUpperCase();
   if(!['GET','POST','PATCH','DELETE'].includes(method))throw fail(400,'Método de Google no permitido.');
   if(method!=='GET'&&!(who.permissions.is_admin||who.permissions.can_edit_records||who.permissions.can_create_database))throw fail(403,'No tienes permiso para modificar contactos.');
   const path=validatePeoplePath(body.path),{token}=await accessToken(),options={method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}};
   if(method!=='GET'&&method!=='DELETE'){const encoded=JSON.stringify(body.body||{});if(encoded.length>100000)throw fail(413,'El contacto es demasiado grande.');options.body=encoded;}
   const google=await request('https://people.googleapis.com/v1/'+path,options),text=await google.text();let data={};try{data=text?JSON.parse(text):{};}catch(_){data={};}
   if(!google.ok)throw fail(google.status===401?409:502,data?.error?.message||'Google Contacts no pudo completar la operación.');return json(res,200,data);
  }
  throw fail(404,'Operación no encontrada.');
 }catch(error){console.error('google-contacts',error.message);return json(res,error.status||500,{ok:false,error:error.message||'Error interno'});}
};

module.exports._test={seal,unseal,validatePeoplePath,identity};
