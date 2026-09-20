/* Read-only contact context. Never copies contact notes into a sales opportunity. */
(function(){
'use strict';
const text=v=>String(v??'').trim();
const field=(d,...keys)=>{for(const k of keys)if(text(d?.[k]))return text(d[k]);return '';};
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const phone=v=>text(v).replace(/\D/g,'').replace(/^(0034|34)(?=\d{9}$)/,'');
function contact(row){
 if(!row?.data||!text(row.id||row.record_id))return null;
 const d=row.data;
 return {id:text(row.id||row.record_id),name:field(d,'NOMBRE Y APELLIDOS')||[field(d,'NOMBRE'),field(d,'APELLIDOS','APELLIDO')].filter(Boolean).join(' '),nickname:field(d,'APODO','Apodo','ALIAS'),phone:field(d,'TELÉFONO','TELEFONO','PHONE','MOVIL'),dni:field(d,'DNI / NIF','DNI','NIF'),notes:field(d,'NOTAS','NOTES'),observations:field(d,'OBSERVACIONES','OBSERVACION','Observaciones')};
}
function people(state){
 if(!state||state.loading||state.error)return {contacts:[],holder:null,manager:null};
 const own=contact(state.owner),items=(state.items||[]).map(contact).filter(Boolean),managers=(state.managers||[]).map(contact).filter(Boolean);
 const all=[...new Map([own,...items,...managers].filter(Boolean).map(x=>[x.id,x])).values()];
 let holder=null,manager=null;
 if(state.historical){
  const p=state.previous||{};
  // Snapshot names/phones remain authoritative. Only enrich with an unambiguous
  // contact already related to the linked record; never search by a shared phone.
  const saved=(name,dni,tel)=>{
   if(!text(name))return null;
   const matches=all.filter(x=>norm(x.name)===norm(name)&&(!text(dni)||norm(x.dni)===norm(dni))&&(!phone(tel)||phone(x.phone)===phone(tel)));
   return matches.length===1?matches[0]:null;
  };
  holder=saved(p.holder_name,p.holder_dni,p.holder_phone);
  manager=p.same===false?saved(p.contact_name,p.contact_dni,p.contact_phone):null;
 }else{
  const selected=items.find(x=>x.id===state.selected);
  holder=state.selected==='legacy'?null:selected||own;
  manager=selected||state.selected==='legacy'?own:managers.length===1?managers[0]:managers.find(x=>x.id===state.managerId)||null;
 }
 const contacts=[];
 for(const [person,role]of [[manager,'Contacto / gestor'],[holder,'Titular del contrato'],[own,'Contacto vinculado']]){
  if(person&&!contacts.some(x=>x.id===person.id))contacts.push({...person,role});
 }
 return {holder,manager,contacts};
}
async function loadExtras(client,id){
 if(!text(id))return {labels:[],tasks:[],taskCount:0};
 const results=await Promise.allSettled([
  Promise.resolve().then(()=>client.rpc('crm_get_contact_labels',{p_contact_id:text(id)})),
  Promise.resolve().then(()=>client.from('agenda_items').select('id,title,starts_at,related_record_id',{count:'exact'}).eq('related_record_id',text(id)).eq('status','pending').or('whatsapp_enabled.is.null,whatsapp_enabled.eq.false').order('starts_at',{ascending:true}).limit(3))
 ]);
 const labels=results[0].status==='fulfilled'&&!results[0].value.error?results[0].value:null;
 const tasks=results[1].status==='fulfilled'&&!results[1].value.error?results[1].value:null;
 return {labels:(labels?.data||[]).map(x=>({id:text(x.id||x.label_id),name:text(x.name||x.label_name)})).filter(x=>x.name),labelsError:!labels,tasks:tasks?.data||[],taskCount:tasks?.count??tasks?.data?.length??0,tasksError:!tasks};
}
window.TPFOpportunityContext={contact,people,loadExtras};
})();
