'use strict';
const {fields,phone}=require('./contact-sync');
const clean=x=>String(x??'').trim();
const dni=p=>clean((p.userDefined||[]).find(x=>x.key==='DNI / NIF')?.value).toUpperCase();
const mask='names,nicknames,phoneNumbers,emailAddresses,userDefined,metadata';
const resource=r=>r.data.TPF_GOOGLE_CONTACT?.resource_name;
function validate(manager,holder,account){
 const m=fields(manager.data),h=fields(holder.data),proof=manager.data.TPF_IDENTITY_RECOVERY||{},hp=holder.data.TPF_IDENTITY_RECOVERY||{};
 if(!proof.user_confirmed_at&&!proof.user_authorized_at)throw Error('Falta la autorización de recuperación de identidad.');
 if(proof.holder_record_id!==holder.id||hp.manager_record_id!==manager.id||phone(hp.previous_phone_owned_by_manager)!==m.phone||h.phone||!m.phone||!m.dni||!h.dni||m.dni===h.dni)throw Error('Las identidades o la relación han cambiado.');
 if(!(manager.data.TPF_RELACIONES?.managed_contacts||[]).some(x=>x.record_id===holder.id)||!resource(holder))throw Error('Falta el vínculo exacto del titular.');
 if(clean(holder.data.TPF_GOOGLE_CONTACT.google_account).toLowerCase()!==clean(account).toLowerCase())throw Error('La cuenta de Google no coincide.');
 return {m,h};
}
async function repair(manager,holder,{google,save,account}){
 const {m,h}=validate(manager,holder,account),people=[];
 let page='';do{const r=await google('people/me/connections?personFields='+mask+'&pageSize=1000&sources=READ_SOURCE_TYPE_CONTACT'+(page?'&pageToken='+encodeURIComponent(page):''));people.push(...(r.connections||[]));page=r.nextPageToken||'';}while(page);
 let original=await google(resource(holder)+'?personFields='+mask);
 if(dni(original)!==h.dni.toUpperCase())throw Error('El DNI del titular en Google no coincide. No se ha cambiado.');
 const managers=people.filter(p=>dni(p)===m.dni.toUpperCase());
 if(managers.length>1)throw Error('Hay varias fichas del gestor en Google. Revisión necesaria.');
 let target=resource(manager)?await google(resource(manager)+'?personFields='+mask):managers[0];
 if(target&&dni(target)!==m.dni.toUpperCase())throw Error('El vínculo del gestor apunta a otro DNI.');
 if(target&&(!(target.phoneNumbers||[]).some(x=>phone(x.value)===m.phone)||target.resourceName===original.resourceName))throw Error('La ficha de Google del gestor tiene otro teléfono.');
 if(people.some(p=>p.resourceName!==original.resourceName&&p.resourceName!==target?.resourceName&&(p.phoneNumbers||[]).some(x=>phone(x.value)===m.phone)))throw Error('Otro contacto de Google usa el teléfono del gestor.');
 const previous=manager.data.TPF_IDENTITY_GOOGLE_REPAIR||{};
 if(!target&&previous.status==='create_requested')throw Error('Alta de gestor pendiente de confirmar en Google. No se repetirá para evitar duplicados.');
 const audit={...previous,version:1,status:'prepared',holder_record_id:holder.id,google_account:account,holder_before:previous.holder_before||original,manager_before:previous.manager_before||target||null};
 await save(manager,{TPF_IDENTITY_GOOGLE_REPAIR:audit});
 const remaining=(original.phoneNumbers||[]).filter(x=>phone(x.value)!==m.phone).map(({value,type})=>({value,type}));
 if(remaining.length!==(original.phoneNumbers||[]).length){
  original=await google(original.resourceName+':updateContact?updatePersonFields=phoneNumbers&personFields='+mask,{method:'PATCH',body:{resourceName:original.resourceName,etag:original.etag,metadata:original.metadata,phoneNumbers:remaining}});
 }
 const holderAfter=await google(resource(holder)+'?personFields='+mask);
 if(dni(holderAfter)!==h.dni.toUpperCase()||(holderAfter.phoneNumbers||[]).some(x=>phone(x.value)===m.phone))throw Error('Google no confirma la separación del teléfono.');
 if(!target){
  await save(manager,{TPF_IDENTITY_GOOGLE_REPAIR:{...audit,status:'create_requested'}});
  target=await google('people:createContact?personFields='+mask,{method:'POST',body:{names:[{givenName:m.first,familyName:m.last}],phoneNumbers:[{value:'+'+m.phone,type:'mobile'}],userDefined:[{key:'DNI / NIF',value:m.dni}],...(m.email?{emailAddresses:[{value:m.email,type:'work'}]}:{}),...(m.nickname?{nicknames:[{value:m.nickname,type:'DEFAULT'}]}:{})}});
 }
 if(!target?.resourceName)throw Error('Google no confirmó el alta del gestor. Revisa antes de repetir.');
 await save(manager,{TPF_GOOGLE_CONTACT:{version:1,resource_name:target.resourceName,google_account:account,updated_at:new Date().toISOString()}});
 const managerAfter=await google(target.resourceName+'?personFields='+mask);
 if(dni(managerAfter)!==m.dni.toUpperCase()||clean(managerAfter.names?.[0]?.givenName)!==m.first||clean(managerAfter.names?.[0]?.familyName)!==m.last||!(managerAfter.phoneNumbers||[]).some(x=>phone(x.value)===m.phone))throw Error('Google no confirma la identidad del gestor.');
 const now=new Date().toISOString();
 await save(manager,{TPF_GOOGLE_CONTACT:{version:1,resource_name:managerAfter.resourceName,google_account:account,updated_at:now},TPF_IDENTITY_GOOGLE_REPAIR:{...audit,status:'completed',completed_at:now,holder_after:holderAfter,manager_after:managerAfter},TPF_CONTACT_SYNC:{status:'review',error:'Google separado y comprobado. Verificación de nombre WhatsApp pendiente.',updated_at:now}});
 await save(holder,{TPF_IDENTITY_GOOGLE_REPAIR:{version:1,status:'completed',manager_record_id:manager.id,google_account:account,completed_at:now,holder_before:audit.holder_before,holder_after:holderAfter},TPF_CONTACT_SYNC:{status:'review',error:'Titular conservado en Google. Sin teléfono WhatsApp propio.',updated_at:now}});
 return {ok:true,holder:holder.id,manager:manager.id,holderResource:holderAfter.resourceName,managerResource:managerAfter.resourceName};
}
module.exports={repair,validate};
