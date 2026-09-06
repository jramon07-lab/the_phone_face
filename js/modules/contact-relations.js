(function(){
'use strict';
const P=window.TPFContactParty;if(!P||window.TPFContactRelations)return;
const $=id=>document.getElementById(id),clean=v=>String(v??'').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const original={...P},forms=new WeakMap();let opportunity=null,profileToken=0;
function identity(r){const d=r?.data||{};return {record_id:clean(r?.id),name:clean(d['NOMBRE Y APELLIDOS']||[d.NOMBRE,d.APELLIDOS].filter(Boolean).join(' ')),phone:clean(d['TELÉFONO']||d.TELEFONO||d.PHONE||d.MOVIL),dni:clean(d['DNI / NIF']||d.DNI)};}
function links(p){return Array.isArray(p?.managed_contacts)?p.managed_contacts.filter(x=>x&&clean(x.record_id)).map(x=>({record_id:clean(x.record_id),name:clean(x.name),phone:clean(x.phone),dni:clean(x.dni)})):[];}
function match(x,q){return norm([x.name,x.phone,x.dni].join(' ')).includes(norm(q))||(/\d{3}/.test(q)&&x.phone.replace(/\D/g,'').includes(q.replace(/\D/g,'')));}
async function record(id){const r=await sb.from('records').select('id,data').eq('source_sheet','BASE DE DATOS').eq('id',id).maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error('La ficha vinculada ya no existe o no tienes acceso.');return r.data;}
async function managers(id){if(!id)return [];const r=await sb.from('records').select('id,data').eq('source_sheet','BASE DE DATOS').contains('data',{TPF_RELACIONES:{managed_contacts:[{record_id:id}]}}).limit(20);if(r.error)throw r.error;return r.data||[];}
async function searchRecords(q,active=()=>true){
 // Page under the signed-in user's existing RLS. Never use privileged keys.
 const result=[];for(let start=0;start<50000;start+=500){if(!active())return [];
  const r=await sb.from('records').select('id,data').eq('source_sheet','BASE DE DATOS').order('id').range(start,start+499);if(r.error)throw r.error;
  if(!active())return [];for(const row of r.data||[]){const x=identity(row);if(match(x,q))result.push(x);}
  if(result.length>=30||!r.data||r.data.length<500)return result.slice(0,30);
 }throw Error('Demasiados contactos para esta búsqueda. Utiliza un nombre o DNI más concreto.');
}
function openLink(id){if(id&&typeof openContact==='function')return openContact(id);}
function button(x){if(!x||x.record_id==='legacy')return `<span>${esc(x?.name||'Titular anterior')} · datos guardados</span>`;return `<button type="button" class="secondary tpfRelLink" data-rel-open="${esc(x.record_id)}">${esc(x.name||'Ver ficha')} ↗</button>`;}
function compact(root,label){
 const heading=root.querySelector('h3');if(heading)heading.remove();
 const check=root.querySelector('[data-party="same"]');if(check){check.closest('label').hidden=true;}
 const details=document.createElement('details');details.className='tpfRelLegacy';
 const summary=document.createElement('summary');summary.textContent=label;details.appendChild(summary);
 for(const node of [...root.children])details.appendChild(node);
 root.appendChild(details);return details;
}
function renderSelected(root,state){
 const list=root.querySelector('[data-rel-list]');list.innerHTML=state.items.map((x,i)=>`<div class="tpfRelRow">${button(x)}<span>${esc(x.dni||x.phone)}</span><button type="button" class="secondary" data-rel-remove="${i}" aria-label="Desvincular ${esc(x.name)}">Quitar vínculo</button></div>`).join('');
 root.querySelector('[data-rel-count]').textContent=state.items.length?` (${state.items.length})`:'';
}
function contactId(){const modal=$('tpfContactsCreateBack');return clean(modal?.dataset.editId||(modal?.dataset.tpfProfileEditing&&typeof currentContact!=='undefined'?currentContact?.id:''));}
P.fillContact=function(data){
 original.fillContact(data);const root=$('tpfContactParty');if(!root)return;
 const p=data?.TPF_TITULAR||{},state={items:links(data?.TPF_RELACIONES),original:p,query:0};forms.set(root,state);
 const legacy=compact(root,p.same===false?'Titular anterior: '+(p.holder_name||'Ver datos'):'Opciones de destinatario');
 if(p.same!==false)legacy.hidden=true;
 const section=document.createElement('div');section.innerHTML=`<label class="tpf-party-check"><input type="checkbox" data-rel-enabled><span>Ver / añadir titulares asociados<span data-rel-count></span></span></label><div data-rel-panel hidden><div data-rel-list></div><button type="button" class="secondary" data-rel-add>+ Añadir titular</button><div data-rel-searchbox hidden><label>Buscar contacto existente<input type="search" data-rel-search placeholder="Nombre, teléfono o DNI" autocomplete="off"></label><div data-rel-results aria-live="polite"></div><small>Si aún no tiene ficha, créala en Contactos y después vincúlala aquí. No se crean duplicados automáticamente.</small></div></div>`;
 root.prepend(section);renderSelected(root,state);
 root.addEventListener('change',e=>{if(e.target.matches('[data-rel-enabled]'))root.querySelector('[data-rel-panel]').hidden=!e.target.checked;});
 root.addEventListener('click',e=>{
  if(e.target.closest('[data-rel-add]')){root.querySelector('[data-rel-searchbox]').hidden=false;root.querySelector('[data-rel-search]').focus();}
  const remove=e.target.closest('[data-rel-remove]');if(remove){state.items.splice(Number(remove.dataset.relRemove),1);renderSelected(root,state);root.dispatchEvent(new Event('input',{bubbles:true}));}
  const pick=e.target.closest('[data-rel-pick]');if(pick){const x=state.results?.find(x=>x.record_id===pick.dataset.relPick);if(!x||x.record_id===contactId()||state.items.some(y=>y.record_id===x.record_id))return;state.items.push(x);renderSelected(root,state);root.querySelector('[data-rel-results]').textContent='Titular añadido. Guarda los cambios para confirmar.';root.querySelector('[data-rel-search]').value='';root.dispatchEvent(new Event('input',{bubbles:true}));}
 });
 let timer;root.querySelector('[data-rel-search]').addEventListener('input',e=>{
  clearTimeout(timer);const token=++state.query,q=e.target.value.trim(),out=root.querySelector('[data-rel-results]');out.textContent=q.length<2?'Escribe al menos dos caracteres.':'Buscando…';if(q.length<2)return;
  timer=setTimeout(async()=>{try{const rows=await searchRecords(q,()=>root.isConnected&&token===state.query);if(!root.isConnected||token!==state.query)return;state.results=rows.filter(x=>x.record_id!==contactId()&&!state.items.some(y=>x.record_id===y.record_id));out.innerHTML=state.results.length?state.results.map(x=>`<button type="button" class="secondary tpfRelResult" data-rel-pick="${esc(x.record_id)}"><b>${esc(x.name||'Sin nombre')}</b><small>${esc(x.dni)} · ${esc(x.phone)}</small></button>`).join(''):'No hay coincidencias disponibles.';}catch(err){if(token===state.query)out.textContent=err.message||'No se pudo buscar. Inténtalo otra vez.';}},300);
 });
};
function applyContactData(data,id){const state=forms.get($('tpfContactParty'));if(!state)throw Error('Vuelve a abrir el contacto para cargar sus titulares.');if(state.items.some(x=>x.record_id===clean(id||contactId())))throw Error('Un contacto no puede vincularse consigo mismo.');data.TPF_RELACIONES={version:1,managed_contacts:state.items.map(x=>({...x}))};}
P.search=function(c){return [original.search(c),...links(c?.data?.TPF_RELACIONES||c?.TPF_RELACIONES).map(x=>[x.name,x.dni,x.phone].join(' '))].join(' ');};
P.renderProfile=function(c){
 let box=$('tpfContactPartySummary');const anchor=document.querySelector('#contactModal .cpData');if(!anchor||!c?.id)return;
 if(!box){box=document.createElement('div');box.id='tpfContactPartySummary';anchor.insertAdjacentElement('afterend',box);}
 const key=JSON.stringify([c.id,c.data?.TPF_TITULAR,c.data?.TPF_RELACIONES]);if(box.dataset.relKey===key)return;box.dataset.relKey=key;
 const token=++profileToken,p=c.data?.TPF_TITULAR||{},items=links(c.data?.TPF_RELACIONES);
 const legacy=p.same===false?`<details><summary>${esc(p.holder_name)} · Titular anterior</summary>${original.summary(p,c)}<small>Datos conservados. Para abrir su ficha, vincula el contacto existente desde Editar datos.</small></details>`:'';
 box.innerHTML=`<section class="tpf-party tpfRelSummary"><details><summary>Titulares asociados (${items.length+(p.same===false?1:0)})</summary>${items.map(x=>`<div class="tpfRelRow">${button(x)}</div>`).join('')}${legacy}<small>Añade o desvincula titulares desde Editar datos.</small></details><div data-rel-managedby></div></section>`;
 managers(c.id).then(rows=>{if(token!==profileToken||!box.isConnected)return;box.querySelector('[data-rel-managedby]').innerHTML=rows.length?`<div class="tpfRelRow">Gestionado por: ${rows.map(r=>button(identity(r))).join(' ')}</div>`:'';}).catch(()=>{if(token===profileToken&&box.isConnected)box.querySelector('[data-rel-managedby]').textContent='No se pudo comprobar quién gestiona esta ficha.';});
};
function opportunityContext(){return clean($('oppModalOpenContact')?.dataset.recordId);}
function drawOpportunity(state){
 const root=state.root;if(opportunity!==state||!root.isConnected)return;
 const old=root.querySelector('[data-rel-opportunity]');if(old)old.remove();
 const box=document.createElement('div');box.dataset.relOpportunity='';
 if(state.error){box.innerHTML=`<p role="alert">${esc(state.error)}</p><button type="button" class="secondary" data-rel-retry>Reintentar</button>`;root.prepend(box);box.querySelector('button').onclick=()=>loadOpportunity(state);return;}
 if(state.loading){box.textContent='Comprobando titulares vinculados…';root.prepend(box);return;}
 if(state.historical){const p=state.previous,own=state.owner?identity(state.owner):null,holder=own&&norm(own.name)===norm(p.holder_name)?own:null,candidates=[...(own?[own]:[]),...state.managers.map(identity)].filter(x=>norm(x.name)===norm(p.contact_name)&&clean(x.phone)===clean(p.contact_phone)),manager=candidates.length===1?candidates[0]:null;box.innerHTML=`<div class="tpfRelRow">Titular: ${holder?button(holder):esc(p.holder_name)}</div><div class="tpfRelRow">Gestionado por: ${manager?button(manager):esc(p.contact_name)}</div>`;root.prepend(box);return;}
 const own=state.owner?identity(state.owner):null;
 box.innerHTML=`${state.items.length?`<label class="tpf-party-check"><input type="checkbox" data-rel-other ${state.selected?'checked':''}><span>La oportunidad es para otra persona</span></label><div data-rel-choices ${state.selected?'':'hidden'}><label>Buscar entre sus titulares<input type="search" data-rel-filter placeholder="Nombre, teléfono o DNI"></label><select data-rel-choice aria-label="Titular de la oportunidad"><option value="">Selecciona un titular</option>${state.items.map(x=>`<option value="${esc(x.record_id)}" ${state.selected===x.record_id?'selected':''}>${esc(x.name)} · ${esc(x.dni||x.phone)}</option>`).join('')}</select></div>`:''}${state.managers.length?`<div class="tpfRelRow">Gestionado por: ${state.managers.length===1?button(identity(state.managers[0])):`<select data-rel-manager aria-label="Elegir gestor"><option value="">Selecciona quién gestiona esta oportunidad</option>${state.managers.map(r=>`<option value="${esc(r.id)}">${esc(identity(r).name)}</option>`).join('')}</select>`}</div>`:''}<div data-rel-selection></div>`;
 root.prepend(box);
 const display=()=>{const x=state.items.find(x=>x.record_id===state.selected);box.querySelector('[data-rel-selection]').innerHTML=x?`<div class="tpfRelRow">Titular: ${button(x)}</div><div class="tpfRelRow">Gestionado por: ${button(own)}</div>`:'';};display();
 box.querySelector('[data-rel-other]')?.addEventListener('change',e=>{box.querySelector('[data-rel-choices]').hidden=!e.target.checked;state.chooseOther=e.target.checked;if(!e.target.checked){state.selected='';box.querySelector('[data-rel-choice]').value='';}display();});
 box.querySelector('[data-rel-choice]')?.addEventListener('change',e=>{state.selected=e.target.value;display();});
 box.querySelector('[data-rel-filter]')?.addEventListener('input',e=>{for(const option of box.querySelector('[data-rel-choice]').options){const x=state.items.find(x=>x.record_id===option.value);option.hidden=!!x&&!match(x,e.target.value);}});
 box.querySelector('[data-rel-manager]')?.addEventListener('change',e=>{state.managerId=e.target.value;});
 root.hidden=!state.items.length&&!state.managers.length&&state.previous?.same!==false;
}
async function loadOpportunity(state){
 state.loading=true;state.error='';drawOpportunity(state);
 try{
  const id=state.ownerId;state.owner=id?await record(id):null;
  state.items=links(state.owner?.data?.TPF_RELACIONES);if(state.previous?.same===false&&!state.historical)state.items.unshift({record_id:'legacy',name:state.previous.holder_name,dni:state.previous.holder_dni,phone:state.previous.holder_phone});state.managers=id?await managers(id):[];
 }catch(e){state.error=e.message||'No se pudieron comprobar los titulares. Reintenta antes de guardar.';}
 state.loading=false;drawOpportunity(state);
}
P.mountOpportunity=function(p){
 original.mountOpportunity(p);const root=$('tpfOpportunityParty');if(!root)return;
 const legacy=compact(root,'Datos del titular guardados');legacy.hidden=true;
 const state={root,previous:p||null,historical:p?.recipient_name!==undefined,items:[],managers:[],selected:'',loading:true};opportunity=state;
 // Native openers fill the contact ID after mounting the party section.
 setTimeout(()=>{if(opportunity!==state||!root.isConnected)return;state.ownerId=opportunityContext();state.opportunityId=clean($('oppModalId')?.value);loadOpportunity(state);},0);
};
async function prepareOpportunity(payload){
 const state=opportunity;if(!state||!state.root.isConnected)throw Error('Vuelve a abrir la oportunidad para cargar sus titulares.');
 if($('oppDetailModal')?.classList.contains('hidden'))throw Error('La oportunidad se ha cerrado. Vuelve a abrirla para guardar.');
 if(state.loading)throw Error('Espera a que se comprueben los titulares vinculados.');
 if(state.error)throw Error(state.error);
 if(state.ownerId!==opportunityContext()||state.opportunityId!==clean($('oppModalId')?.value))throw Error('El contacto ha cambiado. Vuelve a seleccionarlo antes de guardar.');
 // Editing amount/title/stage never recomputes the frozen recipient from the
 // visible client name (which belongs to the holder, not necessarily the manager).
 if(state.historical)return state.previous;
 if(state.chooseOther&&!state.selected)throw Error('Selecciona el titular de esta oportunidad.');
 if(state.selected==='legacy')return original.snapshot(state.previous,{name:$('oppModalClient')?.value,phone:$('oppModalPhone')?.value,dni:$('oppModalDni')?.value});
 if(!state.selected&&!state.managers.length)return original.snapshot({same:true},{name:$('oppModalClient')?.value,phone:$('oppModalPhone')?.value,dni:$('oppModalDni')?.value});
 let holder,manager;
 const selection=state.selected,managerSelection=state.managerId;
 if(state.selected){manager=await record(state.ownerId);if(!links(manager.data?.TPF_RELACIONES).some(x=>x.record_id===state.selected))throw Error('La vinculación ha cambiado. Vuelve a abrir la oportunidad.');holder=await record(state.selected);}
 else {const id=state.managers.length===1?state.managers[0].id:state.managerId;if(!id)throw Error('Selecciona quién gestiona esta oportunidad.');manager=await record(id);if(!links(manager.data?.TPF_RELACIONES).some(x=>x.record_id===state.ownerId))throw Error('La vinculación ha cambiado. Vuelve a abrir la oportunidad.');holder=await record(state.ownerId);}
 if(opportunity!==state||state.ownerId!==opportunityContext()||state.opportunityId!==clean($('oppModalId')?.value)||state.selected!==selection||state.managerId!==managerSelection||$('oppDetailModal')?.classList.contains('hidden'))throw Error('Has cambiado de ficha o de titular. Vuelve a guardar desde la oportunidad correcta.');
 const h=identity(holder),m=identity(manager),parts=h.name.split(' ');
 const party=original.snapshot({same:false,holder_first_name:parts.shift(),holder_last_name:parts.join(' '),holder_dni:h.dni,holder_phone:h.phone,recipient:'contact'},{name:m.name,phone:m.phone,dni:m.dni});
 payload.record_id=h.record_id;payload.client_name=h.name;payload.phone=m.phone||null;
 return party;
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-rel-open]');if(!b)return;e.preventDefault();if(b.closest('#tpfContactParty')){window.alert('Guarda o cancela la edición y abre el titular desde la ficha del contacto.');return;}openLink(b.dataset.relOpen);});
const css=document.createElement('style');css.textContent='.tpfRelRow{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0}.tpfRelLink{color:#2563eb!important}.tpfRelLegacy summary,.tpfRelSummary summary{cursor:pointer;font-weight:600;font-size:14px}.tpfRelLegacy{margin-top:8px}.tpfRelResult{display:flex!important;flex-direction:column;align-items:flex-start;width:100%;text-align:left;margin:5px 0}.tpf-party [data-rel-panel],.tpf-party [data-rel-choices]{margin-top:12px}.tpf-party [data-rel-list]{margin-bottom:8px}.tpf-party [data-rel-searchbox]{margin-top:12px}.tpf-party [data-rel-results]{max-height:220px;overflow:auto}.tpf-party[hidden]{display:none!important}';document.head.appendChild(css);
window.TPFContactRelations={prepareOpportunity,applyContactData,identity,links,match};
})();
