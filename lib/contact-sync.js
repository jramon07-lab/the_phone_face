'use strict';
const clean=v=>String(v??'').trim();
const fold=v=>clean(v).normalize('NFC').replace(/\s+/g,' ').toLocaleLowerCase('es-ES');
function phone(v){let s=clean(v).replace(/\D/g,'');if(s.startsWith('00'))s=s.slice(2);if(/^[6789]\d{8}$/.test(s))s='34'+s;return /^\d{10,15}$/.test(s)?s:'';}
function fields(d){const first=(...ks)=>{for(const k of ks)if(d[k]!=null)return clean(d[k]);return '';};return {first:first('NOMBRE'),last:first('APELLIDOS','APELLIDO'),nickname:first('APODO','Apodo','ALIAS'),phone:phone(first('TELÉFONO','TELEFONO','MOVIL','PHONE')),email:first('EMAIL','Email','email'),dni:first('DNI / NIF','DNI','NIF')};}
const personFields='names,nicknames,phoneNumbers,emailAddresses,userDefined,metadata';
function googleMatches(p,c){const n=p.names?.[0]||{};return fold(n.givenName)===fold(c.first)&&fold(n.familyName)===fold(c.last)&&fold(p.nicknames?.[0]?.value)===fold(c.nickname)&&(p.phoneNumbers||[]).some(x=>phone(x.value)===c.phone)&&fold(p.emailAddresses?.[0]?.value)===fold(c.email)&&fold((p.userDefined||[]).find(x=>x.key==='DNI / NIF')?.value)===fold(c.dni);}
function body(c,p){return {names:[{givenName:c.first,familyName:c.last}],nicknames:c.nickname?[{value:c.nickname,type:'DEFAULT'}]:[],phoneNumbers:[{value:'+'+c.phone,type:'mobile'},...(p?.phoneNumbers||[]).slice(1).filter(x=>phone(x.value)!==c.phone).map(({value,type})=>({value,type}))],emailAddresses:c.email?[{value:c.email,type:'work'}]:[],userDefined:[...(p?.userDefined||[]).filter(x=>x.key!=='DNI / NIF').map(({key,value})=>({key,value})),...(c.dni?[{key:'DNI / NIF',value:c.dni}]:[])],...(p?{resourceName:p.resourceName,etag:p.etag,metadata:p.metadata}:{})};}
const review=message=>Object.assign(new Error(message),{review:true});
const failureStatus=e=>e.review||/is not on WhatsApp|chatId.*invalid phone number/i.test(String(e.message||''))?'review':'retry';
async function syncOne(row,{google,green,people,account,checkpoint}){
 const c=fields(row.data);
 if(!c.first||!c.phone)throw review('Falta nombre o teléfono válido; no se puede verificar en los tres sitios.');
 if(row.duplicates!==1)throw review('Teléfono compartido por varias fichas; requiere decidir qué identidad guardar.');
 const binding=row.data.TPF_GOOGLE_CONTACT||{},resource=row.google_resource||binding.resource_name||binding.resourceName||row.data.TPF_GOOGLE_CONTACT_RESOURCE;
 const savedAccount=row.google_account||binding.google_account||binding.account||row.data.TPF_GOOGLE_CONTACT_ACCOUNT;
 if(savedAccount&&fold(savedAccount)!==fold(account))throw review('El vínculo pertenece a otra cuenta de Google.');
 const hits=people.filter(p=>(p.phoneNumbers||[]).some(x=>phone(x.value)===c.phone));
 if(hits.length>1)throw review('Más de una ficha de Google usa este teléfono.');
 let person=resource?people.find(p=>p.resourceName===resource):hits[0];
 if(resource&&!person)throw review('El contacto vinculado de Google no aparece; revisar antes de crear otro.');
 if(person&&hits.length&&hits[0].resourceName!==person.resourceName)throw review('El teléfono pertenece a otra ficha de Google.');
 if(person&&!resource){
  const n=person.names?.[0]||{},googleName=fold([n.givenName,n.familyName].filter(Boolean).join(' ')),crmName=fold([c.first,c.last].filter(Boolean).join(' '));
  const googleDni=fold((person.userDefined||[]).find(x=>x.key==='DNI / NIF')?.value);
  if((googleDni&&c.dni&&googleDni!==fold(c.dni))||(googleName&&googleName!==crmName&&!(googleDni&&googleDni===fold(c.dni))))throw review('El teléfono coincide con otra identidad en Google; no se sobrescribe automáticamente.');
 }
 if(!person){
  try{person=await google('people:createContact?personFields='+personFields,{method:'POST',body:body(c)});}
  catch(e){throw review('No se confirmó el alta en Google; revisar antes de repetir para evitar duplicados.');}
  if(!person?.resourceName)throw review('Google no devolvió el identificador creado.');
  people.push(person);
 }
 await checkpoint(person.resourceName,account);
 if(!googleMatches(person,c)){
  const full=await google(person.resourceName+'?personFields='+personFields);
  person=await google(full.resourceName+':updateContact?updatePersonFields=names,nicknames,phoneNumbers,emailAddresses,userDefined&personFields='+personFields,{method:'PATCH',body:body(c,full)});
 }
 const confirmed=await google(person.resourceName+'?personFields='+personFields);
 if(!googleMatches(confirmed,c))throw Error('Google todavía no confirma todos los datos guardados.');
 const cached=people.findIndex(p=>p.resourceName===confirmed.resourceName);if(cached>=0)people[cached]=confirmed;else people.push(confirmed);
 const chatId=c.phone+'@c.us',visible=[c.first,c.last,c.nickname].filter(Boolean).join(' ');
 let info=await green('getContactInfo',{chatId});
 if(fold(info.contactName)!==fold(visible)){
  const payload={chatId,firstName:c.first,lastName:[c.last,c.nickname].filter(Boolean).join(' '),saveInAddressbook:false};
  let result;
  if(clean(info.contactName))result=await green('editContact',payload);
  else{
   try{result=await green('addContact',payload);}
   catch(e){if(e.status===400&&/already exists/i.test(e.message))result=await green('editContact',payload);else throw e;}
  }
  if(result?.addContact!==true&&result?.editContact!==true)throw Error('WhatsApp no confirmó el contacto guardado.');
  info=await green('getContactInfo',{chatId});
 }
 if(fold(info.contactName)!==fold(visible))throw Error('WhatsApp todavía no confirma el nombre y apodo guardados.');
 const now=new Date().toISOString(),local=c.phone.startsWith('34')&&c.phone.length===11?c.phone.slice(2):c.phone;
 return {TPF_GOOGLE_CONTACT:{version:1,resource_name:confirmed.resourceName,google_account:fold(account),updated_at:now},TPF_WHATSAPP_CHAT_ID:chatId,TPF_WHATSAPP_NAME_CONFIRMED:{chat_id:chatId,confirmed_at:now,source:'server_contact_sync'},TPF_CONTACT_VERIFIED:{version:1,signature:JSON.stringify([row.id,local,c.first,c.last,c.nickname]),chat_id:chatId,whatsapp_name:info.contactName,google_account:fold(account),google_resource:confirmed.resourceName,verified_at:now,source:'server_readback'}};
}
async function run({db,google,green,account,limit=15}){
 const people=[];let page='';
 do{const p=await google('people/me/connections?personFields='+personFields+'&pageSize=1000&sources=READ_SOURCE_TYPE_CONTACT'+(page?'&pageToken='+encodeURIComponent(page):''));people.push(...(p.connections||[]));page=p.nextPageToken||'';}while(page);
 const results=[],start=Date.now();
 let lastGreen=0;const pacedGreen=async(...args)=>{const delay=1100-(Date.now()-lastGreen);if(delay>0)await new Promise(r=>setTimeout(r,delay));lastGreen=Date.now();return green(...args);};
 for(let i=0;i<limit&&Date.now()-start<150000;i++){
  const row=await db('rpc/crm_claim_contact_sync',{});if(!row)break;
  const finish=(status,error,metadata,resource,acct)=>db('rpc/crm_finish_contact_sync',{p_id:row.id,p_revision:row.revision,p_status:status,p_error:error||null,p_metadata:metadata||null,p_resource:resource||null,p_account:acct||null});
  try{
   const metadata=await syncOne(row,{google,green:pacedGreen,people,account,checkpoint:async(r,a)=>{if(!await finish('checkpoint',null,null,r,a))throw Error('El contacto cambió durante la sincronización.');}});
   const saved=await finish('verified',null,metadata,metadata.TPF_GOOGLE_CONTACT.resource_name,account);
   results.push({id:row.id,status:saved?'verified':'changed'});
  }catch(e){const status=failureStatus(e);await finish(status,e.message);results.push({id:row.id,status,error:e.message});}
 }
 return {ok:true,processed:results.length,results};
}
module.exports={run,syncOne,fields,googleMatches,phone,failureStatus};
