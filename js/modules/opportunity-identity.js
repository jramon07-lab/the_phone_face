/* One read-only identity model for desktop opportunities and installation recipients. */
(function(){
'use strict';
const str=value=>String(value??'').trim();
function resolve(o={},offers=[]){
 const p=o.contract_party||{},same=p.same!==false;
 const holder={id:p.holder_record_id||p.holder_contact_id||(same?o.record_id:null),name:p.holder_name||o.client_name||'Sin titular',dni:str(Object.hasOwn(p,'holder_dni')?p.holder_dni:same?o.dni:''),phone:str(Object.hasOwn(p,'holder_phone')?p.holder_phone:same?o.phone:'')};
 const manager={id:p.manager_record_id||p.manager_contact_id||o.record_id,name:p.contact_name||(same?holder.name:'Sin gestor indicado'),phone:str(Object.hasOwn(p,'contact_phone')?p.contact_phone:same?holder.phone:o.phone)};
 const target=p.recipient==='holder'?holder:manager;
 const recipient={id:p.recipient_contact_id||(same?target.id:p.recipient==='holder'?p.holder_record_id||p.holder_contact_id||null:p.manager_record_id||p.manager_contact_id||null),name:p.recipient_name||target.name,phone:target.phone};
 if(Object.hasOwn(p,'recipient_phone'))recipient.phone=str(p.recipient_phone);
 else if(!same)recipient.phone=str(p.recipient==='holder'?p.holder_phone:p.contact_phone);
 else{
  const saved=offers.filter(x=>Object.hasOwn(x.snapshot||{},'recipient_phone')).slice().sort((a,b)=>str(b.created_at).localeCompare(str(a.created_at)))[0];
  if(saved){const snap=saved.snapshot;recipient.phone=str(snap.recipient_phone);recipient.name=p.recipient_name||snap.recipient_name||snap.contact_name||recipient.name;recipient.id=p.recipient_contact_id||snap.recipient_contact_id||recipient.id;}
  else recipient.phone=str(o.phone||target.phone);
 }
 return {holder,manager,recipient};
}
function installation(row={},o={}){
 const ctx=row.recipient_context||{},people=resolve({...o,client_name:row.client_name||o.client_name,contract_party:ctx.contract_party||o.contract_party||{}});
 return {...people,recipient:{id:ctx.recipient_contact_id||ctx.contact_id||people.recipient.id,name:ctx.contract_party?.recipient_name||ctx.name||people.recipient.name||row.client_name,phone:Object.hasOwn(ctx,'phone')?str(ctx.phone):people.recipient.phone}};
}
window.TPFOpportunityIdentity=Object.freeze({resolve,installation});
})();
