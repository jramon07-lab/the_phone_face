(function(){
'use strict';
const P=window.TPFContactParty;if(!P||window.TPFContactRelations)return;
const $=id=>document.getElementById(id),clean=v=>String(v??'').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const displayPhone=v=>P.displayPhone?P.displayPhone(v):clean(v);
const displayName=v=>clean(v).toLocaleLowerCase('es').replace(/(^|[\s'-])\p{L}/gu,c=>c.toLocaleUpperCase('es'));
const original={...P},forms=new WeakMap();let opportunity=null,profileToken=0,profileRevision=0;
function identity(r){const d=r?.data||{};return {record_id:clean(r?.id),name:clean(d['NOMBRE Y APELLIDOS']||[d.NOMBRE,d.APELLIDOS].filter(Boolean).join(' ')),phone:clean(d['TELÉFONO']||d.TELEFONO||d.PHONE||d.MOVIL),dni:clean(d['DNI / NIF']||d.DNI)};}
function links(p){return Array.isArray(p?.managed_contacts)?p.managed_contacts.filter(x=>x&&clean(x.record_id)).map(x=>({record_id:clean(x.record_id),name:clean(x.name),phone:clean(x.phone),dni:clean(x.dni)})):[];}
function match(x,q){return norm([x.name,x.phone,x.dni].join(' ')).includes(norm(q))||(/\d{3}/.test(q)&&x.phone.replace(/\D/g,'').includes(q.replace(/\D/g,'')));}
async function record(id){const r=await sb.from('records').select('id,data').eq('source_sheet','BASE DE DATOS').eq('id',id).maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error('La ficha vinculada ya no existe o no tienes acceso.');return r.data;}
async function managers(id){if(!id)return [];const r=await sb.from('records').select('id,data').eq('source_sheet','BASE DE DATOS').contains('data',{TPF_RELACIONES:{managed_contacts:[{record_id:id}]}}).limit(20);if(r.error)throw r.error;return r.data||[];}
async function removeManagedLink(managerId,associatedId){
 const manager=await record(managerId),old=links(manager.data?.TPF_RELACIONES),next=old.filter(x=>x.record_id!==clean(associatedId));
 if(next.length===old.length)return false;
 const data={...(manager.data||{}),TPF_RELACIONES:{...(manager.data?.TPF_RELACIONES||{}),version:1,managed_contacts:next}};
 const saved=await sb.from('records').update({data}).eq('id',manager.id).eq('data',JSON.stringify(manager.data||{})).select('id,data').single();
 if(saved.error||!saved.data)throw saved.error||Error('No se confirmó la eliminación de la relación.');
 return true;
}
async function searchRecords(q,active=()=>true){
 // Page under the signed-in user's existing RLS. Never use privileged keys.
 const result=[];for(let start=0;start<50000;start+=500){if(!active())return [];
  const r=await sb.from('records').select('id,data').eq('source_sheet','BASE DE DATOS').order('id').range(start,start+499);if(r.error)throw r.error;
  if(!active())return [];for(const row of r.data||[]){const x=identity(row);if(match(x,q))result.push(x);}
  if(result.length>=30||!r.data||r.data.length<500)return result.slice(0,30);
 }throw Error('Demasiados contactos para esta búsqueda. Utiliza un nombre o DNI más concreto.');
}
function openLink(id){if(id&&typeof openContact==='function')return openContact(id);}
function button(x){if(!x||x.record_id==='legacy')return `<span>${esc(displayName(x?.name||'Titular anterior'))} · datos guardados</span>`;return `<button type="button" class="secondary tpfRelLink" data-rel-open="${esc(x.record_id)}">${esc(displayName(x.name||'Ver ficha'))} ↗</button>`;}
function holderCard(holder,manager){
 return `<section class="tpf-party tpf-party-summary tpfRelCard"><h3>Titular del contrato</h3>${button(holder)}<p>DNI / NIF: ${esc(holder.dni||'—')}<br>Teléfono: ${esc(displayPhone(holder.phone)||'—')}</p><div class="tpf-party-recipient"><b>WhatsApp automático</b><span>${esc(displayName(manager.name))} · ${esc(displayPhone(manager.phone)||'Sin teléfono')}</span></div></section>`;
}
function profilePartyCard(person,role,manager){
 const initials=displayName(person.name).split(/\s+/).slice(0,2).map(x=>x[0]||'').join('');
 return `<article class="tpfProfilePartyCard"><span class="tpfProfilePartyAvatar" aria-hidden="true">${esc(initials)}</span><div><strong>${esc(displayName(person.name))}</strong><small>${esc(role)}</small></div><button type="button" class="secondary" data-rel-open="${esc(person.record_id)}">Ver ficha</button><details class="tpfPartyMore"><summary>Datos y relación</summary><p>DNI / NIF: ${esc(person.dni||'—')}<br>Teléfono: ${esc(displayPhone(person.phone)||'—')}</p>${manager?`<p>WhatsApp automático: ${esc(displayName(manager.name))} · ${esc(displayPhone(manager.phone)||'Sin teléfono')}</p>`:`<button type="button" class="secondary" data-rel-remove-manager="${esc(person.record_id)}">Quitar relación</button>`}</details></article>`;
}
async function currentHolders(items,includeData=false){
 if(!items.length)return [];
 const out=[];
 for(let start=0;start<items.length;start+=100){
  const r=await sb.from('records').select('id,data').eq('source_sheet','BASE DE DATOS').in('id',items.slice(start,start+100).map(x=>x.record_id));
  if(r.error)throw r.error;out.push(...(r.data||[]));
 }
 const byId=new Map(out.map(r=>[clean(r.id),includeData?{...identity(r),data:r.data}:identity(r)]));
 return items.map(x=>byId.get(x.record_id)).filter(Boolean);
}
function compact(root,label){
 const heading=root.querySelector('h3');if(heading)heading.remove();
 const check=root.querySelector('[data-party="same"]');if(check){check.closest('label').hidden=true;}
 const details=document.createElement('details');details.className='tpfRelLegacy';
 const summary=document.createElement('summary');summary.textContent=label;details.appendChild(summary);
 for(const node of [...root.children])details.appendChild(node);
 root.appendChild(details);return details;
}
function editorItems(state){return state.loading||state.error?[]:state.items.filter(x=>!state.missing?.has(x.record_id)).map(x=>state.current?.get(x.record_id)||x);}
async function refreshEditorLinks(root,state){
 state.loading=true;state.error='';renderSelected(root,state);
 try{const rows=await currentHolders(state.items);if(forms.get(root)!==state||!root.isConnected)return;state.current=new Map(rows.map(x=>[x.record_id,x]));state.missing=new Set(state.items.filter(x=>!state.current.has(x.record_id)).map(x=>x.record_id));}
 catch(e){if(forms.get(root)!==state||!root.isConnected)return;state.error='No se pudieron comprobar los titulares. Reintenta antes de guardar.';}
 state.loading=false;renderSelected(root,state);
}
function renderSelected(root,state){
 const list=root.querySelector('[data-rel-list]');list.innerHTML=editorItems(state).map(x=>{const i=state.items.findIndex(item=>item.record_id===x.record_id);return `<div class="tpfRelRow"><div class="tpfRelLinkedIdentity"><strong>${esc(displayName(x.name))}</strong><span>${esc(x.dni||displayPhone(x.phone))}</span></div><div class="tpfRelLinkedActions"><button type="button" class="secondary" data-rel-open="${esc(x.record_id)}">Abrir ficha</button><button type="button" class="secondary" data-rel-edit-contact="${esc(x.record_id)}">Editar</button><button type="button" class="secondary" data-rel-remove="${i}" aria-label="Desvincular ${esc(x.name)}">Quitar vínculo</button></div></div>`;}).join('');
 root.querySelector('[data-rel-count]').textContent=state.loading?'…':String(editorItems(state).length);
 if(state.loading)list.textContent='Comprobando titulares…';
 else if(state.error){list.textContent=state.error;const retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.textContent='Reintentar';retry.onclick=()=>refreshEditorLinks(root,state);list.append(retry);}
 else if(!editorItems(state).length)list.textContent='No hay titulares vinculados disponibles.';
 root.querySelector('[data-rel-add]').disabled=!!(state.loading||state.error);
}
function contactId(){const modal=$('tpfContactsCreateBack');return clean(modal?.dataset.editId||(modal?.dataset.tpfProfileEditing&&typeof currentContact!=='undefined'?currentContact?.id:''));}
function newHolderData(values){
 const first=clean(values.first),last=clean(values.last),phone=clean(values.phone),dni=clean(values.dni).toUpperCase(),email=clean(values.email);
 if(!first&&!last)throw Error('Escribe el nombre o los apellidos del titular.');
 if(phone&&!P.validPhone(phone))throw Error('Revisa el teléfono del titular.');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Revisa el correo electrónico.');
 return {NOMBRE:first,APELLIDOS:last,'NOMBRE Y APELLIDOS':[first,last].filter(Boolean).join(' '),'TELÉFONO':displayPhone(phone),'DNI / NIF':dni,DNI:dni,EMAIL:email,TPF_TITULAR:{same:true,recipient:'contact'}};
}
async function createHolder(data,attempt,active,showDuplicates){
 if(typeof perms==='undefined'||!(perms?.is_admin||perms?.can_create_database))throw Error('No tienes permiso para crear contactos.');
 if(attempt.issued)throw Error('Comprueba primero en el buscador si el titular se creó. No se repetirá el envío.');
 const ensure=()=>{if(!active())throw Error('La edición ha cambiado. No se ha creado el titular.');};ensure();
 const result=await sb.rpc('find_possible_duplicate_contact',{phone_text:data['TELÉFONO']||null,dni_text:data.DNI||null,email_text:data.EMAIL||null});if(result.error)throw result.error;ensure();
 const names=await searchRecords(data['NOMBRE Y APELLIDOS'],active);ensure();
 const phones=data['TELÉFONO']?await searchRecords(data['TELÉFONO'].replace(/\D/g,''),active):[];ensure();
 const phoneKey=v=>displayPhone(v).replace(/\D/g,'');
 const candidates=[...new Map([...(result.data||[]).map(identity),...names.filter(x=>norm(x.name)===norm(data['NOMBRE Y APELLIDOS'])),...phones.filter(x=>phoneKey(x.phone)===phoneKey(data['TELÉFONO']))].map(x=>[x.record_id,x])).values()];
 if(candidates.length){showDuplicates(candidates);if(!window.confirm('Hay posibles contactos duplicados. Puedes cancelar y elegir uno en los resultados. ¿Confirmas que es otra persona y quieres crear una ficha nueva?'))return null;}
 ensure();attempt.issued=true;
 const saved=await sb.rpc('crm_create_contact_with_welcome_variant',{p_data:data,p_labels:[],p_welcome:false,p_variant:'general'});
 if(saved.error){if(/^[0-9A-Z]{5}$/.test(saved.error.code||''))attempt.issued=false;throw saved.error;}
 if(!saved.data)throw Error('No se ha podido confirmar la creación. Búscalo antes de intentarlo otra vez.');
 return identity({id:saved.data,data});
}
P.fillContact=function(data){
 original.fillContact(data);const root=$('tpfContactParty');if(!root)return;
 const labels=$('tpfCompactLabels')||$('tpfCreateLabels')?.closest('label');if(labels)labels.insertAdjacentElement('afterend',root);
 const p=data?.TPF_TITULAR||{},state={items:links(data?.TPF_RELACIONES),original:p,query:0};forms.set(root,state);
 const legacy=compact(root,p.same===false?'Titular anterior: '+(p.holder_name||'Ver datos'):'Opciones de destinatario');
 if(p.same!==false)legacy.hidden=true;
 const section=document.createElement('details');section.className='tpfEditorRelations';section.innerHTML=`<summary>Titulares asociados <span data-rel-count></span></summary><div data-rel-panel><div data-rel-list></div><button type="button" class="secondary" data-rel-add>+ Añadir titular</button><div data-rel-searchbox hidden><label>Buscar contacto existente<input type="search" data-rel-search placeholder="Nombre, teléfono o DNI" autocomplete="off"></label><div data-rel-results aria-live="polite"></div><small>Si aún no tiene ficha, créala en Contactos y después vincúlala aquí. No se crean duplicados automáticamente.</small></div></div>`;
 root.prepend(section);refreshEditorLinks(root,state);
 const searchBox=root.querySelector('[data-rel-searchbox]');searchBox.querySelector('small').textContent='Busca una ficha existente o crea un titular nuevo aquí.';
 searchBox.insertAdjacentHTML('beforeend',`<button type="button" class="secondary" data-rel-new>+ Crear nuevo titular</button><div data-rel-newform hidden><div class="tpf-party-grid"><label>Nombre<input data-rel-newfield="first" autocomplete="off"></label><label>Apellidos<input data-rel-newfield="last" autocomplete="off"></label><label>DNI / NIF<input data-rel-newfield="dni" autocomplete="off"></label><label>Teléfono (opcional)<input data-rel-newfield="phone" inputmode="tel" autocomplete="off"></label><label>Correo electrónico (opcional)<input data-rel-newfield="email" type="email" autocomplete="off"></label></div><p>Crear titular guarda una ficha nueva. Después guarda el contacto principal para confirmar el vínculo. Si cancelas la edición, la nueva ficha seguirá en Contactos.</p><button type="button" class="primary" data-rel-create>Crear titular y añadir</button><button type="button" class="secondary" data-rel-cancelnew>Cancelar nuevo titular</button><div data-rel-createmsg role="status" aria-live="polite"></div></div>`);
 let attempt={issued:false};
 root.querySelector('[data-rel-new]').onclick=()=>{root.querySelector('[data-rel-newform]').hidden=false;root.querySelector('[data-rel-newfield="first"]').focus();};
 root.querySelector('[data-rel-cancelnew]').onclick=()=>{root.querySelector('[data-rel-newform]').hidden=true;};
 root.querySelector('[data-rel-create]').onclick=async()=>{
  if(state.creating)return;const msg=root.querySelector('[data-rel-createmsg]');
  const active=()=>root.isConnected&&$('tpfContactParty')===root&&!$('tpfContactsCreateBack')?.classList.contains('hidden');
  const controls=[...root.querySelectorAll('input,button'),...['tpfContactsCreateSave','tpfContactsCreateCancel','tpfContactsCreateClose'].map($).filter(Boolean)],disabled=controls.map(x=>x.disabled);
  try{
   const data=newHolderData(Object.fromEntries([...root.querySelectorAll('[data-rel-newfield]')].map(x=>[x.dataset.relNewfield,x.value])));state.creating=true;controls.forEach(x=>x.disabled=true);msg.textContent='Comprobando y guardando…';
   const x=await createHolder(data,attempt,active,rows=>{state.results=rows;root.querySelector('[data-rel-results]').innerHTML=rows.map(x=>`<button type="button" class="secondary tpfRelResult" data-rel-pick="${esc(x.record_id)}"><b>${esc(x.name)}</b><small>${esc(x.dni)} · ${esc(displayPhone(x.phone))}</small></button>`).join('');});
   if(!x){msg.textContent='No se ha creado ninguna ficha. Puedes elegir un contacto existente en los resultados.';return;}
   if(!active()){window.alert('El titular se ha creado. Búscalo en Contactos para vincularlo; la edición anterior se cerró.');return;}
   state.items.push(x);renderSelected(root,state);attempt={issued:false};root.querySelectorAll('[data-rel-newfield]').forEach(x=>x.value='');root.querySelector('[data-rel-newform]').hidden=true;root.querySelector('[data-rel-results]').textContent='Titular creado y añadido. Guarda el contacto principal para confirmar el vínculo.';root.dispatchEvent(new Event('input',{bubbles:true}));
  }catch(error){msg.textContent=(error.message||'No se pudo crear el titular.')+(attempt.issued?' Antes de volver a crear, comprueba en el buscador si ya existe.':'');}
  finally{state.creating=false;if(active())controls.forEach((x,i)=>x.disabled=disabled[i]);}
 };
 root.addEventListener('click',e=>{
  if(state.creating){e.preventDefault();e.stopPropagation();return;}
  if(e.target.closest('[data-rel-add]')){root.querySelector('[data-rel-searchbox]').hidden=false;root.querySelector('[data-rel-search]').focus();}
  const remove=e.target.closest('[data-rel-remove]');if(remove){state.items.splice(Number(remove.dataset.relRemove),1);renderSelected(root,state);root.dispatchEvent(new Event('input',{bubbles:true}));}
  const pick=e.target.closest('[data-rel-pick]');if(pick){const x=state.results?.find(x=>x.record_id===pick.dataset.relPick);if(!x||x.record_id===contactId()||state.items.some(y=>y.record_id===x.record_id))return;state.items.push(x);renderSelected(root,state);root.querySelector('[data-rel-results]').textContent='Titular añadido. Guarda los cambios para confirmar.';root.querySelector('[data-rel-search]').value='';root.dispatchEvent(new Event('input',{bubbles:true}));}
 });
 let timer;root.querySelector('[data-rel-search]').addEventListener('input',e=>{
  clearTimeout(timer);const token=++state.query,q=e.target.value.trim(),out=root.querySelector('[data-rel-results]');out.textContent=q.length<2?'Escribe al menos dos caracteres.':'Buscando…';if(q.length<2)return;
  timer=setTimeout(async()=>{try{const rows=await searchRecords(q,()=>root.isConnected&&token===state.query);if(!root.isConnected||token!==state.query)return;state.results=rows.filter(x=>x.record_id!==contactId()&&!state.items.some(y=>x.record_id===y.record_id));out.innerHTML=state.results.length?state.results.map(x=>`<button type="button" class="secondary tpfRelResult" data-rel-pick="${esc(x.record_id)}"><b>${esc(x.name||'Sin nombre')}</b><small>${esc(x.dni)} · ${esc(displayPhone(x.phone))}</small></button>`).join(''):'No hay coincidencias disponibles.';}catch(err){if(token===state.query)out.textContent=err.message||'No se pudo buscar. Inténtalo otra vez.';}},300);
 });
};
function applyContactData(data,id){const state=forms.get($('tpfContactParty'));if(!state)throw Error('Vuelve a abrir el contacto para cargar sus titulares.');if(state.creating)throw Error('Espera a que termine la creación del titular.');if(state.loading)throw Error('Espera a que se comprueben los titulares.');if(state.error)throw Error(state.error);if(state.items.some(x=>x.record_id===clean(id||contactId())))throw Error('Un contacto no puede vincularse consigo mismo.');data.TPF_RELACIONES={version:1,managed_contacts:editorItems(state).map(x=>({...x}))};}
P.search=function(c){return [original.search(c),...links(c?.data?.TPF_RELACIONES||c?.TPF_RELACIONES).map(x=>[x.name,x.dni,x.phone].join(' '))].join(' ');};
P.hint=function(c={},records){
 const linked=links(c.data?.TPF_RELACIONES||c.TPF_RELACIONES);
 const current=records?new Map(records.map(r=>[clean(r.id),r])):null;
 const names=linked.map(x=>current?(current.has(x.record_id)?identity(current.get(x.record_id)).name:''):x.name).filter(Boolean).map(displayName);
 const p=c.contract_party||c.data?.TPF_TITULAR||c.TPF_TITULAR;
 if(p?.same===false&&p.holder_name&&!names.some(n=>norm(n)===norm(p.holder_name)))names.unshift(displayName(p.holder_name));
 return names.length?`<small class="tpf-party-hint">${names.length===1?'Titular':'Titulares'}: ${names.map(esc).join(' · ')}</small>`:'';
};
P.renderProfile=function(c){
 let box=$('tpfContactPartySummary');const anchor=document.querySelector('#contactModal .cpData');if(!anchor||!c?.id)return;
 if(!box){box=document.createElement('div');box.id='tpfContactPartySummary';anchor.insertAdjacentElement('afterend',box);}
 const key=JSON.stringify([c.id,c.data?.TPF_TITULAR,c.data?.TPF_RELACIONES,profileRevision]);if(box.dataset.relKey===key)return;
 const wasOpen=box.dataset.relContact===clean(c.id)&&!!box.querySelector('[data-rel-holders]')?.open;
 box.dataset.relKey=key;box.dataset.relContact=clean(c.id);
 const token=++profileToken,p=c.data?.TPF_TITULAR||{},items=links(c.data?.TPF_RELACIONES);
 const legacy=p.same===false?`<details><summary>${esc(p.holder_name)} · Titular anterior</summary>${original.summary(p,c)}<small>Datos conservados. Para abrir su ficha, vincula el contacto existente desde Editar datos.</small></details>`:'';
 box.innerHTML=`<section class="tpf-party tpfRelSummary"><details data-rel-holders${wasOpen?' open':''}><summary><b>Titulares y gestores</b><span class="tpfRelationCounts"><span data-rel-total>${items.length+(p.same===false?1:0)}</span> titulares · <span data-rel-managers-total>…</span> gestores</span></summary><div class="tpfRelationsContent"><button type="button" class="tpfRelationsManage" data-rel-manage-profile>Gestionar</button><h4>Titulares asociados</h4><div data-rel-cards>${items.length?'Comprobando titulares…':''}</div>${legacy}<div data-rel-managedby></div><small>Añade o desvincula titulares desde Gestionar.</small></div></details></section>`;
 box.querySelector("[data-rel-manage-profile]").onclick=()=>$("tpfContactEditToggle")?.click();
 const active=()=>token===profileToken&&box.isConnected;
 const refresh=async()=>{try{
  const holders=await currentHolders(items);if(!active())return;
  box.querySelector('[data-rel-total]').textContent=String(holders.length+(p.same===false?1:0));
  box.querySelector('[data-rel-cards]').innerHTML=holders.map(x=>profilePartyCard(x,'Titular',identity(c))).join('')||(!legacy?'No hay titulares vinculados disponibles.':'');
 }catch(e){if(!active())return;const out=box.querySelector('[data-rel-cards]');out.innerHTML='<p>No se pudieron cargar los titulares. Los vínculos se conservan.</p><button type="button" class="secondary" data-rel-retry>Reintentar</button>';out.querySelector('button').onclick=refresh;}};
 refresh();
 managers(c.id).then(rows=>{if(token!==profileToken||!box.isConnected)return;const target=box.querySelector('[data-rel-managedby]');box.querySelector('[data-rel-managers-total]').textContent=String(rows.length);target.innerHTML=rows.length?`<h4>Gestionado por</h4><div class="tpfProfileManagers">${rows.map(r=>profilePartyCard(identity(r),'Gestor')).join('')}</div>`:'';target.querySelectorAll('[data-rel-remove-manager]').forEach(btn=>btn.onclick=async()=>{const managerId=clean(btn.dataset.relRemoveManager);if(!managerId||!window.confirm('¿Quitar esta relación? No se borra ningún contacto.'))return;btn.disabled=true;try{await removeManagedLink(managerId,c.id);profileRevision++;delete box.dataset.relKey;P.renderProfile(c);window.dispatchEvent(new CustomEvent('tpf:contact-updated',{detail:{id:managerId}}));}catch(error){window.alert(error.message||'No se pudo quitar la relación.');btn.disabled=false;}});}).catch(()=>{if(token===profileToken&&box.isConnected)box.querySelector('[data-rel-managedby]').textContent='No se pudo comprobar quién gestiona esta ficha.';});
};
window.addEventListener('tpf:contacts-loaded',e=>{
 profileRevision++;
 if(typeof currentContact==='undefined'||!currentContact?.id||$('contactModal')?.classList.contains('hidden'))return;
 const fresh=e.detail?.records?.find(r=>clean(r.id)===clean(currentContact.id));
 if(fresh){currentContact.data=fresh.data;P.renderProfile(currentContact);}
 else{profileToken++;const box=$('tpfContactPartySummary');if(box)box.innerHTML='Esta ficha ya no está disponible.';}
});
function opportunityContext(){return clean($('oppModalOpenContact')?.dataset.recordId);}
function opportunityContacts(state=opportunity){
 if(!state||state.ownerId!==opportunityContext()||state.opportunityId!==clean($('oppModalId')?.value))return {contacts:[],holder:null,manager:null};
 return window.TPFOpportunityContext?.people(state)||{contacts:[],holder:null,manager:null};
}
function opportunityPreview(state=opportunity){
 const fallback={holder:clean($('oppModalClient')?.value)||'Sin titular indicado',dni:'',manager:'',recipient:clean($('oppModalClient')?.value),phone:clean($('oppModalPhone')?.value),pending:false};
 if(!state||state.ownerId!==opportunityContext()||state.opportunityId!==clean($('oppModalId')?.value))return {...fallback,loading:true};
 if(state.loading||state.error)return {...fallback,loading:!!state.loading,error:state.error||''};
 const p=state.previous;
 if(state.historical)return {holder:p.holder_name||fallback.holder,dni:p.holder_dni||'',manager:p.same===false?p.contact_name||'Sin gestor indicado':'',recipient:p.recipient_name||p.contact_name||fallback.recipient,phone:p.recipient_phone||p.contact_phone||fallback.phone,pending:false};
 if(state.selected==='legacy'&&p)return {holder:p.holder_name||fallback.holder,dni:p.holder_dni||'',manager:fallback.recipient,recipient:p.recipient==='holder'?p.holder_name:fallback.recipient,phone:p.recipient==='holder'?p.holder_phone:fallback.phone,pending:!!state.selectionDirty};
 const own=state.owner?identity(state.owner):null,selected=state.items.find(x=>x.record_id===state.selected);
 if(!selected&&state.managerId==='self')return {holder:own?.name||fallback.holder,dni:own?.dni||'',manager:'',recipient:own?.name||fallback.recipient,phone:own?.phone||'',pending:!!state.selectionDirty};
 const manager=selected?own:state.managers.length===1?identity(state.managers[0]):identity(state.managers.find(x=>x.id===state.managerId));
 const holder=selected||(state.managers.length?own:null);
 return {holder:holder?.name||fallback.holder,dni:holder?.dni||own?.dni||'',manager:manager?.name||(state.managers.length?'Selecciona un gestor':''),recipient:manager?.name||(state.managers.length?'Pendiente de elegir':fallback.recipient),phone:manager?.phone||(state.managers.length?'':fallback.phone),pending:!!state.suggested||!!state.selectionDirty};
}
function beginOpportunityEdit(state){
 if(!state.editBaseline)state.editBaseline={historical:state.historical,selected:state.selected,managerId:state.managerId,chooseOther:state.chooseOther,selectionDirty:state.selectionDirty,suggested:state.suggested,selectionInitialized:state.selectionInitialized};
 if(state.historical){const people=opportunityContacts(state);state.selected=state.items.some(x=>x.record_id===people.holder?.id)?people.holder.id:'';state.chooseOther=!!state.selected;state.managerId=people.manager?.id||(state.previous?.same!==false?'self':'');}
 else if(state.managers.length===1&&!state.managerId)state.managerId=state.managers[0].id;
 state.selectionInitialized=true;state.editorOpen=true;
}
function cancelOpportunityEdit(state){if(state.editBaseline)Object.assign(state,state.editBaseline);state.editBaseline=null;state.editorOpen=false;}
function markOpportunityEdit(state){state.historical=false;state.selectionDirty=true;state.suggested=false;}
function notifyOpportunityPreview(){window.dispatchEvent(new CustomEvent('tpf:opportunity-party-preview'));}
function drawOpportunity(state){
 const root=state.root;if(opportunity!==state||!root.isConnected)return;
 const old=root.querySelector('[data-rel-opportunity]');if(old)old.remove();
 const box=document.createElement('div');box.dataset.relOpportunity='';root.hidden=false;root.prepend(box);
 if(state.error){box.innerHTML=`<p role="alert">${esc(state.error)}</p><button type="button" class="secondary" data-rel-retry>Reintentar</button>`;box.querySelector('button').onclick=()=>loadOpportunity(state);notifyOpportunityPreview();return;}
 if(state.loading){box.textContent='Comprobando titulares vinculados…';notifyOpportunityPreview();return;}
 const canChoose=state.items.length||state.managers.length;
 box.innerHTML=`<div class="tpfRelHeading"><h3>Titular y gestión</h3>${canChoose?`<button type="button" class="secondary" data-rel-edit aria-expanded="${!!state.editorOpen}">${state.editorOpen?'Cerrar edición':'Editar vinculación'}</button>`:''}</div><div class="tpfRelIdentityGrid" data-rel-selection></div>${canChoose?`<div data-rel-editor ${state.editorOpen?'':'hidden'}>${state.items.length?`<label class="tpf-party-check"><input type="checkbox" data-rel-other ${state.chooseOther||state.selected?'checked':''}><span>La oportunidad es para otra persona</span></label><div data-rel-choices ${state.chooseOther||state.selected?'':'hidden'}><label ${state.items.length>4?'':'hidden'}>Buscar entre sus titulares<input type="search" data-rel-filter placeholder="Nombre, teléfono o DNI"></label><select data-rel-choice aria-label="Titular de la oportunidad"><option value="">Selecciona un titular</option>${state.items.map(x=>`<option value="${esc(x.record_id)}" ${state.selected===x.record_id?'selected':''}>${esc(x.name)} · ${esc(x.dni||displayPhone(x.phone))}</option>`).join('')}</select></div>`:''}${state.managers.length?`<label>Gestionado por<select data-rel-manager aria-label="Elegir gestor"><option value="" disabled>Selecciona un gestor</option><option value="self" ${state.managerId==='self'?'selected':''}>El propio titular</option>${state.managers.map(r=>`<option value="${esc(r.id)}" ${state.managerId===r.id?'selected':''}>${esc(identity(r).name)}</option>`).join('')}</select></label>`:''}<p class="tpfRelEditHint">Los cambios de vinculación se aplican al guardar esta oportunidad.</p><button type="button" class="secondary" data-rel-cancel>Cancelar cambios de vinculación</button></div>`:''}<p class="crmEditMessage" data-rel-edit-error role="alert" hidden></p>`;
 const display=()=>{
  const info=opportunityPreview(state),people=opportunityContacts(state);
  const initials=name=>clean(name).split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toLocaleUpperCase('es');
  const personCard=(role,name,person,detail,copyValue,copyLabel)=>`<div class="tpfRelPerson"><span class="tpfRelCaption">${role}</span><div class="tpfRelPersonBody"><span class="tpfRelAvatar" aria-hidden="true">${esc(initials(name))}</span><div><strong>${esc(name)}</strong>${person?.nickname?`<span class="tpfRelNickname">${esc(person.nickname)}</span>`:''}<small>${esc(detail)}${copyValue?`<button type="button" class="tpfRelCopy" data-rel-copy="${esc(copyValue)}" aria-label="${esc(copyLabel)}" title="${esc(copyLabel)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg></button>`:''}</small>${person?.id?`<button type="button" class="secondary tpfRelLink" data-rel-open="${esc(person.id)}">Abrir ficha ↗</button><button type="button" class="secondary tpfRelLink" data-rel-contact-edit="${esc(person.id)}">Editar ${role!=='Gestionado por'?'titular':'gestor'}</button>`:''}</div></div></div>`;
  const samePerson=!!people.holder?.id&&(people.holder.id===people.manager?.id||(!people.manager&&!info.manager&&!info.loading&&!info.error));
  const selection=box.querySelector('[data-rel-selection]');selection.classList.toggle('tpfRelSamePerson',samePerson);
  selection.innerHTML=personCard(samePerson?'Titular y gestor':'Titular del contrato',info.holder,people.holder,'DNI / NIF: '+(info.dni||'Sin indicar'),info.dni,'Copiar DNI del titular')+(samePerson?'':personCard('Gestionado por',info.manager||'El propio titular',people.manager||(!info.manager?people.holder:null),info.manager?'Teléfono: '+(displayPhone(people.manager?.phone)||'Sin indicar'):'Gestiona su propio contrato',people.manager?.phone,'Copiar teléfono del gestor'));
  let recipient=box.querySelector('.tpfRelRecipient');if(!recipient){recipient=document.createElement('div');recipient.className='tpfRelRecipient';box.querySelector('[data-rel-selection]').after(recipient);}
  recipient.textContent='WhatsApp dirigido a: '+(info.recipient||'Sin destinatario')+' · '+(displayPhone(info.phone)||'Sin teléfono');
  notifyOpportunityPreview();
 };display();
 box.addEventListener('click',async e=>{const copy=e.target.closest('[data-rel-copy]');if(!copy)return;e.preventDefault();e.stopPropagation();try{await navigator.clipboard.writeText(copy.dataset.relCopy);copy.title='Copiado';copy.setAttribute('aria-label','Copiado');setTimeout(()=>{if(copy.isConnected){copy.title='Copiar';copy.setAttribute('aria-label','Copiar dato');}},1500);}catch(_){window.prompt('Selecciona y copia el dato:',copy.dataset.relCopy);}});
 box.addEventListener('click',async e=>{const button=e.target.closest('[data-rel-contact-edit]');if(!button)return;e.preventDefault();e.stopPropagation();const error=box.querySelector('[data-rel-edit-error]');error.hidden=true;button.disabled=true;try{await window.TPFOpportunityContext.editContact(button.dataset.relContactEdit);}catch(err){error.textContent=err.message;error.hidden=false;}finally{button.disabled=false;}});
 box.querySelector('[data-rel-edit]')?.addEventListener('click',()=>{if(state.editorOpen)state.editorOpen=false;else beginOpportunityEdit(state);drawOpportunity(state);});
 box.querySelector('[data-rel-cancel]')?.addEventListener('click',()=>{cancelOpportunityEdit(state);drawOpportunity(state);});
 box.querySelector('[data-rel-other]')?.addEventListener('change',e=>{box.querySelector('[data-rel-choices]').hidden=!e.target.checked;state.chooseOther=e.target.checked;markOpportunityEdit(state);if(!e.target.checked){state.selected='';box.querySelector('[data-rel-choice]').value='';}display();});
 box.querySelector('[data-rel-choice]')?.addEventListener('change',e=>{state.selected=e.target.value;markOpportunityEdit(state);display();});
 box.querySelector('[data-rel-filter]')?.addEventListener('input',e=>{for(const option of box.querySelector('[data-rel-choice]').options){const x=state.items.find(x=>x.record_id===option.value);option.hidden=!!x&&!match(x,e.target.value);}});
 box.querySelector('[data-rel-manager]')?.addEventListener('change',e=>{state.managerId=e.target.value;markOpportunityEdit(state);display();});
 root.hidden=!state.ownerId&&!state.previous;
}
// Use a unique linked holder only for opportunities without a saved contract.
// Saved snapshots remain authoritative; multiple holders require a choice.
function defaultLinkedHolder(state){
 if(state.previous||state.historical||state.selectionInitialized)return;
 state.selectionInitialized=true;
 if(state.items.length===1&&!state.managers.length){state.selected=state.items[0].record_id;state.chooseOther=true;state.suggested=true;}
}
async function loadOpportunity(state){
 state.loading=true;state.error='';drawOpportunity(state);
 try{
  const id=state.ownerId;state.owner=id?await record(id):null;
  state.items=await currentHolders(links(state.owner?.data?.TPF_RELACIONES),true);if(state.previous?.same===false&&!state.historical)state.items.unshift({record_id:'legacy',name:state.previous.holder_name,dni:state.previous.holder_dni,phone:state.previous.holder_phone});state.managers=id?await managers(id):[];if(state.previous?.same===false&&!state.historical&&!state.selectionInitialized){state.selected='legacy';state.chooseOther=true;state.selectionInitialized=true;}defaultLinkedHolder(state);
 }catch(e){state.error=e.message||'No se pudieron comprobar los titulares. Reintenta antes de guardar.';}
 state.loading=false;drawOpportunity(state);
}
P.mountOpportunity=function(p){
 original.mountOpportunity(p);const root=$('tpfOpportunityParty');if(!root)return;
 const slot=$('crmOpportunityPartySlot');if(slot)slot.append(root);
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
 if(!state.selected&&state.managerId==='self'){
  const row=await record(state.ownerId),own=identity(row);
  if(opportunity!==state||state.ownerId!==opportunityContext()||state.opportunityId!==clean($('oppModalId')?.value)||state.managerId!=='self'||state.selected||$('oppDetailModal')?.classList.contains('hidden'))throw Error('La ficha ha cambiado. Vuelve a comprobar el titular.');
  payload.record_id=own.record_id;payload.client_name=own.name;payload.phone=own.phone||null;
  return original.snapshot({same:true},{name:own.name,phone:own.phone,dni:own.dni});
 }
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
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-rel-open]');if(!b)return;e.preventDefault();e.stopPropagation();if(b.closest('#tpfContactParty')){window.TPFContactEditor?.visitContact(b.dataset.relOpen);return;}openLink(b.dataset.relOpen);},true);
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-rel-edit-contact]');if(!b||!b.closest('#tpfContactParty'))return;e.preventDefault();e.stopPropagation();window.TPFContactEditor?.visitContact(b.dataset.relEditContact,true);},true);
const css=document.createElement('style');css.textContent='.tpfRelRow{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0}.tpfRelLink{color:#2563eb!important;text-transform:none!important}.tpfRelCard{margin-top:12px}.tpfRelCard>.tpfRelLink{background:transparent!important;border:0!important;padding:0!important;text-align:left;font-size:16px;font-weight:700}.tpfRelLegacy summary,.tpfRelSummary summary{cursor:pointer;font-weight:600;font-size:14px}.tpfRelLegacy{margin-top:8px}.tpfRelResult{display:flex!important;flex-direction:column;align-items:flex-start;width:100%;text-align:left;margin:5px 0}.tpf-party [data-rel-panel],.tpf-party [data-rel-choices]{margin-top:12px}.tpf-party [data-rel-list]{margin-bottom:8px}.tpf-party [data-rel-searchbox]{margin-top:12px}.tpf-party [data-rel-results]{max-height:220px;overflow:auto}.tpf-party[hidden]{display:none!important}';document.head.appendChild(css);
window.addEventListener('tpf:contact-updated',e=>{const state=opportunity;if(!state||state.loading||$('oppDetailModal')?.classList.contains('hidden'))return;const ids=[state.ownerId,...state.items.map(x=>x.record_id),...state.managers.map(x=>x.id)];if(!e.detail?.id||ids.includes(clean(e.detail.id)))loadOpportunity(state);});
window.TPFContactRelations={contactFingerprint:root=>JSON.stringify(forms.get(root)?.items||[]),opportunityContacts,opportunityPreview,prepareOpportunity,applyContactData,identity,links,match,searchRecords,record};
})();
