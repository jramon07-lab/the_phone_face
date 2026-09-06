(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TPFRecordLinks=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const text=v=>String(v??'').trim();
const name=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
function phone(v){let p=text(v).replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);if(p.length===11&&p.startsWith('34'))p=p.slice(2);return p.length>=7?p:'';}
function identity(row){const d=row?.data||{};return {id:text(row?.id),name:name(row?.fullName||d['NOMBRE Y APELLIDOS']||[d.NOMBRE,d.APELLIDOS].filter(Boolean).join(' ')||d.CLIENTE),phones:[...new Set([row?.phone,d['TELÉFONO'],d.TELEFONO,d.PHONE,d.MOVIL,d['TELÉFONO 2'],d['TELÉFONO 3'],d.TELEFONO_2,d.TELEFONO_3,...(row?.phones||[]).map(p=>p.number||p.value||p)].map(phone).filter(Boolean))]};}
function index(contacts){const ids=new Map(),phones=new Map(),names=new Map(),managers=new Map();const add=(map,key,id)=>{if(!key)return;if(!map.has(key))map.set(key,new Set());map.get(key).add(id)};
 for(const row of contacts||[]){const c=identity(row);if(!c.id)continue;ids.set(c.id,row);add(names,c.name,c.id);c.phones.forEach(p=>add(phones,p,c.id));}
 for(const row of contacts||[]){for(const link of row.data?.TPF_RELACIONES?.managed_contacts||row.relations?.managed_contacts||[]){const id=text(link.record_id);if(ids.has(id)&&id!==text(row.id))add(managers,id,text(row.id));}}
 return {ids,phones,names,managers};
}
function owner(row,lookup,kind='task'){
 const explicit=text(kind==='task'?row.related_record_id:(row.record_id||row.contact_id));
 // A stale explicit link must never silently become a different person.
 if(explicit)return lookup.ids.has(explicit)?explicit:'';
 const p=phone(kind==='task'?(row.customer_phone||row.phone):row.phone),n=name(kind==='task'?(row.customer_name||row.client_name):row.client_name);
 const candidates=p?lookup.phones.get(p):lookup.names.get(n);
 return candidates?.size===1?[...candidates][0]:'';
}
function isTask(row){return !row.whatsapp_enabled&&name(row.title)!=='whatsapp programado';}
function related(rows,contacts,id,kind='task'){
 const lookup=index(contacts),target=text(id);return (rows||[]).filter(row=>{if(kind==='task'&&!isTask(row))return false;const who=owner(row,lookup,kind);return who===target||(kind==='opportunity'&&lookup.managers.get(who)?.has(target));});
}
const cache=new WeakMap();
async function load(client){const previous=cache.get(client);if(previous&&Date.now()-previous.time<15000)return previous.promise;
 const promise=(async()=>{const rows=[];for(let from=0;;from+=500){const r=await client.from('records').select('id,data').eq('source_sheet','BASE DE DATOS').order('id').range(from,from+499);if(r.error)throw r.error;rows.push(...(r.data||[]));if((r.data||[]).length<500)return rows;}})();
 cache.set(client,{promise,time:Date.now()});try{return await promise;}catch(e){cache.delete(client);throw e;}
}
function invalidate(client){cache.delete(client);}
return {phone,identity,index,owner,related,isTask,load,invalidate};
});
