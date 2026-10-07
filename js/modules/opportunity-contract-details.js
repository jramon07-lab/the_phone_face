/* Opportunity contract metadata and explicit party navigation. No send side effects. */
(function(){
'use strict';
const $=id=>document.getElementById(id),text=v=>String(v||'').trim();
const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.addEventListener('click',e=>{
 const nav=e.target.closest?.('.nav[data-view]');if(!nav)return;
 window.__tpfOpportunityOpenVersion=(window.__tpfOpportunityOpenVersion||0)+1;
 if(typeof tpfPushCurrentScreen==='function')tpfPushCurrentScreen();
 if(typeof tpfCloseAllDetails==='function')tpfCloseAllDetails();
 else for(const id of ['opportunityFullPage','oppDetailModal'])$(id)?.classList.add('hidden');
 $('oppFullMore')?.removeAttribute('open');
},true);
const dates={terminal_commitment_end:'oppModalTerminalEnd',discount_end_date:'oppModalDiscountEnd'};
const dateLabel=v=>v?String(v).split('T')[0].split('-').reverse().join('/'):'Sin indicar';
function validDate(v){if(!v)return null;const d=new Date(v+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw Error('Indica una fecha válida.');return v;}
function party(o){return window.TPFOpportunityIdentity.resolve(o,window.TPFOfferFollowup?.state?.byOpportunity?.get(String(o.id))||[]);}
function operator(o){return text(o.installation_operator)||text((o.title||'').match(/vodafone|másmóvil|masmovil|orange|movistar|jazztel|yoigo|digi|o2|finetwork/i)?.[0])||'Sin indicar';}
function previous(o,i,x){if(i)return text(i.previous_operator)||'Sin indicar';if(o.after_sale_preferences?.previous_operator_saved===true)return text(o.after_sale_preferences.previous_operator)||'Sin indicar';if(o.previous_operator!=null)return text(o.previous_operator)||'Sin indicar';if(Object.hasOwn(x?.snapshot||{},'previous_operator_override'))return text(x.snapshot.previous_operator_override)||'Sin indicar';return text(o.after_sale_preferences?.previous_operator)||text(x?.snapshot?.previous_operator)||'Sin indicar';}
let editorToken=0,viewToken=0,editorOpportunity=null;
function fillEditor(o){
 editorOpportunity=o||null;const token=++editorToken;
 for(const [key,id]of Object.entries(dates))if($(id))$(id).value=o?.[key]||'';
 const input=$('oppModalPreviousOperator');if(input){input.value=o?previous(o)==='Sin indicar'?'':previous(o):'';input.readOnly=false;input.dataset.originalValue=input.value;}
 $('oppPreviousManage')?.setAttribute('hidden','');
 if($('oppPreviousHint'))$('oppPreviousHint').textContent='Compañía de la que viene el cliente.';
 if(o?.id)Promise.all([loadInstallation(o.id),loadOffer(o.id)]).then(([i,x])=>{
  if(token!==editorToken||text($('oppModalId')?.value)!==text(o.id)||!input)return;if(!i){input.value=previous(o,null,x)==='Sin indicar'?'':previous(o,null,x);input.dataset.originalValue=input.value;return;}
  input.value=previous(o,i)==='Sin indicar'?'':previous(o,i);input.readOnly=true;input.dataset.originalValue=input.value;
  $('oppPreviousManage').hidden=false;
  $('oppPreviousHint').textContent='Operador anterior de la instalación. Usa «Editar instalación / devolución» para cambiar sus instrucciones.';
  $('oppPreviousManage').onclick=()=>window.TPFInstallations?.manage(o.id,{edit:'return'});
  input.dispatchEvent(new Event('change',{bubbles:true}));
 }).catch(()=>{if(token===editorToken&&$('oppPreviousHint'))$('oppPreviousHint').textContent='No se pudo comprobar la instalación. Reabre la oportunidad antes de cambiar el operador anterior.';if(token===editorToken&&input)input.readOnly=true;});
}
function readEditor(payload){
 for(const [key,id]of Object.entries(dates))if($(id))payload[key]=validDate($(id).value);
 const input=$('oppModalPreviousOperator');
 if(input&&!input.readOnly){payload.previous_operator=text(input.value)||null;
  payload.after_sale_preferences={...(editorOpportunity?.after_sale_preferences||payload.after_sale_preferences||{}),previous_operator:payload.previous_operator||'',previous_operator_saved:true};
 }
 return payload;
}
function afterPrepare(payload){if(payload.after_sale_preferences?.previous_operator)payload.previous_operator=payload.after_sale_preferences.previous_operator;return payload;}
async function loadInstallation(id){const r=await sb.from('crm_installations').select('previous_operator,appointment_date,installed_on,return_due_at').eq('opportunity_id',id).maybeSingle();if(r.error)throw r.error;return r.data;}
function bindActions(root,o,people){
 for(const button of root.querySelectorAll('[data-opp-copy]'))button.onclick=async()=>{try{await navigator.clipboard.writeText(button.dataset.oppCopy);button.textContent='Copiado';setTimeout(()=>{if(button.isConnected)button.textContent='Copiar';},1500);}catch(_){window.prompt('Selecciona y copia el dato:',button.dataset.oppCopy);}};
 for(const button of root.querySelectorAll('[data-opp-person]')){const p=people[button.dataset.oppPerson];button.disabled=!p?.id;button.onclick=()=>{if(root.id==='oppFullContent')return window.returnToContactFromOpportunity(p.id,o.id);return window.openContact(p.id);};}
 for(const button of root.querySelectorAll('[data-opp-whatsapp]')){button.disabled=!text(people.recipient.phone);button.onclick=async()=>{try{await window.TPFLinkedActions.open(button.dataset.oppWhatsapp,{phone:people.recipient.phone,name:people.recipient.name,contactId:people.recipient.id});}catch(e){alert(e.message);}};}
}
function personData(label,value){return '<small class="oppPersonData"><span>'+esc(label)+': <strong>'+esc(value||'Sin indicar')+'</strong></span>'+(value?'<button type="button" class="oppCopyData" data-opp-copy="'+esc(value)+'" aria-label="Copiar '+esc(label.toLowerCase())+'">Copiar</button>':'')+'</small>';}
function rolesHTML(people){return '<section class="oppContractPeople" aria-label="Titular, gestor y destinatario">'+[['holder','Titular del contrato'],['manager','Gestionado por'],['recipient','WhatsApp dirigido a']].map(([key,label])=>'<div class="oppContractPerson"><span>'+label+'</span><button type="button" class="oppContactLink" data-opp-person="'+key+'">'+esc(people[key].name)+'</button>'+(key==='holder'?personData('DNI / NIF del titular',people.holder.dni)+personData('Teléfono del titular',people.holder.phone):personData(key==='manager'?'Teléfono del gestor':'Teléfono de WhatsApp',people[key].phone))+'</div>').join('')+'</section><div class="oppContractActions"><button type="button" class="secondary" data-opp-whatsapp="conversation">Ir a conversación</button><button type="button" class="primary" data-opp-whatsapp="message">Escribir WhatsApp</button></div>';}
async function completePersonData(people,o){
 // Read only confirmed record IDs. Never substitute the manager's DNI for the holder.
 for(const key of ['holder','manager']){
  const person=people[key],p=o.contract_party||{},phoneField=key==='holder'?'holder_phone':'contact_phone',readPhone=!person.phone&&!Object.hasOwn(p,phoneField),readDni=key==='holder'&&!person.dni&&!Object.hasOwn(p,'holder_dni');if(!person.id||(!readPhone&&!readDni))continue;
  const r=await sb.from('records').select('id,data').eq('id',person.id).eq('source_sheet','BASE DE DATOS').maybeSingle();if(r.error)throw r.error;
  if(!r.data||String(r.data.id)!==String(person.id))continue;
  const values=window.TPFContactParty?.contactValues?.(r.data);if(!values)continue;
  if(readPhone)person.phone=values.phone||'';if(readDni)person.dni=values.dni||'';
 }
 return people;
}
function compactHeader(root){
 const top=document.querySelector('#opportunityFullPage .oppFullTop'),heading=document.querySelector('#opportunityFullPage .oppFullHeading');if(!top||!heading)return;
 top.insertBefore($('oppFullTitle'),top.children[1]||null);top.appendChild(heading.querySelector('.oppFullPrimaryActions')||$('oppFullManage').parentNode);heading.hidden=true;
 let menu=$('oppFullMore');if(!menu){menu=document.createElement('details');menu.id='oppFullMore';menu.innerHTML='<summary>Más opciones</summary><div class="oppFullMoreItems"></div>';menu.addEventListener('click',e=>{if(e.target.closest('.oppFullMoreItems button,.oppFullMoreItems a'))menu.open=false;});document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.open=false;});document.addEventListener('keydown',e=>{if(e.key==='Escape')menu.open=false;});}top.appendChild(menu);menu.open=false;
 $('oppFullEdit').textContent='Editar ficha completa';const row=top.querySelector('.row'),items=menu.querySelector('div');
 const collect=()=>{for(const b of [...(row?.children||[])])items.appendChild(b);};collect();
 if(row&&!row.dataset.observed){row.dataset.observed='1';new MutationObserver(collect).observe(row,{childList:true});}
 const stage=root.querySelector('.oppReadStage');$('oppFullHeaderStage')?.remove();if(stage){stage.id='oppFullHeaderStage';$('oppFullTitle').after(stage);}root.querySelector('.oppReadHeader')?.remove();
 const origin=root.querySelector('.oppReadOrigin');if(origin){const box=document.createElement('details');box.className='oppReadOrigin oppField';box.innerHTML='<summary>Origen</summary>';origin.querySelector('h3')?.remove();box.append(...origin.childNodes);origin.replaceWith(box);}
}
async function loadOffer(id){const r=await sb.from('crm_offer_instances').select('id,opportunity_id,snapshot,status,created_at,updated_at').eq('opportunity_id',id).order('created_at',{ascending:false}).limit(50);if(r.error)throw r.error;return (r.data||[]).slice().sort((a,b)=>Number(['archived','cancelled','lost'].includes(a.status))-Number(['archived','cancelled','lost'].includes(b.status))||new Date(b.created_at)-new Date(a.created_at))[0]||null;}
function inlineFields(root,o,context){
 const fields=[['amount','Importe de la oportunidad','number'],['expected_date','Fecha prevista de cierre','date'],['previous_operator','Operador anterior','text'],['terminal_commitment_end','Fin de permanencia del terminal','date'],['discount_end_date','Fin de descuento','date']];
 const metrics=root.querySelector('.oppSummaryMetrics');if(!metrics)return;
 for(const [key,label,type]of fields){
  const cell=[...metrics.children].find(el=>el.querySelector('span')?.textContent===label);if(!cell)continue;
  const edit=document.createElement('button');edit.type='button';edit.className='oppInlineEdit';edit.setAttribute('aria-label','Editar '+label.toLowerCase());edit.textContent='✎';cell.append(edit);
  edit.onclick=()=>{
   if(root.querySelector('.oppInlineForm')){root.querySelector('.oppInlineForm input')?.focus();return;}
   if(typeof crmCan==='function'&&!crmCan('can_edit_sales')){alert('No tienes permiso para editar oportunidades.');return;}
   if(key==='previous_operator'&&(!context.ready||context.error)){alert('Espera a que termine la comprobación, o reabre la ficha.');return;}
   if(key==='previous_operator'&&context.installation){window.TPFInstallations?.manage(o.id,{edit:'return'});return;}
   const form=document.createElement('form');form.className='oppInlineForm';form.innerHTML='<label>'+esc(label)+'<input aria-label="'+esc(label)+'" type="'+type+'" '+(type==='number'?'min="0" step="0.01"':'')+'></label><div><button class="primary" type="submit">Guardar</button><button class="secondary" type="button" data-cancel>Cancelar</button></div><p role="status"></p>';
   const input=form.querySelector('input');input.value=key==='previous_operator'?(previous(o,context.installation,context.offer)==='Sin indicar'?'':previous(o,context.installation,context.offer)):o[key]??'';cell.append(form);edit.hidden=true;input.focus();
   const close=()=>{form.remove();edit.hidden=false;edit.focus();};form.querySelector('[data-cancel]').onclick=close;
   form.onsubmit=async e=>{e.preventDefault();let value;try{value=type==='date'?validDate(input.value):type==='number'?(input.value===''?null:Number(input.value)):text(input.value);if(type==='number'&&value!==null&&(!Number.isFinite(value)||value<0))throw Error('Indica un importe válido.');for(const b of form.querySelectorAll('button,input'))b.disabled=true;
    let saved;
    if(key==='previous_operator'){const r=await sb.rpc('crm_set_previous_operator',{p_opportunity_id:o.id,p_expected_updated_at:o.updated_at,p_previous_operator:value,p_offer_id:context.offer?.id||null,p_expected_offer_updated_at:context.offer?.updated_at||null});if(r.error)throw r.error;saved=r.data?.opportunity;}
    else{if(!o.updated_at)throw Error('Reabre la ficha para comprobar su versión.');const r=await sb.from('sales_opportunities').update({[key]:value}).eq('id',o.id).eq('updated_at',o.updated_at).select('*').single();if(r.error)throw r.error;saved=r.data;}
    if(!saved)throw Error('No se confirmó el guardado. Reabre la ficha.');Object.assign(o,saved);close();await window.openOpportunityFull(o.id);window.dispatchEvent(new CustomEvent('tpf:sales-updated'));
   }catch(error){form.querySelector('[role=status]').textContent=error.message||'No se pudo guardar.';for(const b of form.querySelectorAll('button,input'))b.disabled=false;}}
  };
 }
}
async function decorateView(o){
 const token=++viewToken,root=$('oppFullContent');if(!root)return;root.dataset.opportunityId=o.id;
 const manage=$('oppFullManage');if(manage){manage.disabled=false;manage.onclick=async()=>{manage.disabled=true;try{if(typeof window.TPFHomeManage?.openOpportunity!=='function')throw Error('La gestión no está disponible. Actualiza la página.');await window.TPFHomeManage.openOpportunity(o.id);}catch(e){alert(e.message||'No se pudo abrir la gestión.');}finally{manage.disabled=false;}};}
 const context={ready:false,installation:null,offer:null,error:false};compactHeader(root);const people=party(o),old=root.querySelector('.oppContactSummary');if(old)old.outerHTML=rolesHTML(people);
 const metrics=root.querySelector('.oppSummaryMetrics');
 if(metrics)metrics.insertAdjacentHTML('beforeend','<div class="oppField"><span>Operador de la oferta</span><strong>'+esc(operator(o))+'</strong></div><div class="oppField"><span>Operador anterior</span><strong data-opp-previous>'+esc(previous(o))+'</strong></div><div class="oppField"><span>Fin de permanencia del terminal</span><strong>'+esc(dateLabel(o.terminal_commitment_end))+'</strong></div><div class="oppField"><span>Fin de descuento</span><strong>'+esc(dateLabel(o.discount_end_date))+'</strong></div>');
 bindActions(root,o,people);inlineFields(root,o,context);
 void completePersonData(people,o).then(()=>{if(token!==viewToken||root.dataset.opportunityId!==String(o.id))return;const roles=root.querySelector('.oppContractPeople');if(roles){const template=document.createElement('template');template.innerHTML=rolesHTML(people);roles.replaceWith(template.content.firstElementChild);bindActions(root,o,people);}}).catch(()=>{if(token===viewToken&&root.dataset.opportunityId===String(o.id)){const roles=root.querySelector('.oppContractPeople');if(roles){const warning=document.createElement('small');warning.setAttribute('role','status');warning.textContent='No se pudieron comprobar los datos que faltan en la ficha del contacto.';roles.append(warning);}}});
 const next=document.createElement('section');next.className='oppField oppContractNext';next.innerHTML='<h3>Instalación y devolución</h3><p data-opp-installation>Comprobando la instalación…</p>';metrics?.after(next);
 try{const [i,x]=await Promise.all([loadInstallation(o.id),loadOffer(o.id)]);context.ready=true;context.installation=i;context.offer=x;if(token!==viewToken||!root.contains(next))return;root.querySelector('[data-opp-previous]').textContent=previous(o,i,x);next.querySelector('p').textContent=i?.installed_on?'Instalada: '+dateLabel(i.installed_on):i?.appointment_date?'Cita de instalación: '+dateLabel(i.appointment_date):'Sin cita de instalación registrada.';
  if(i?.return_due_at)next.querySelector('p').textContent+=' · Devolución prevista: '+new Date(i.return_due_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'});
 }catch(e){context.error=true;if(token===viewToken&&root.contains(next))next.querySelector('p').textContent='No se pudo comprobar la instalación. Las fechas del contrato siguen visibles.';}
}
function editorActions(){
 const slot=$('crmOpportunityPartySlot');if(!slot||slot.querySelector('.oppContractActions'))return;
 const actions=document.createElement('div');actions.className='oppContractActions';actions.innerHTML='<button type="button" class="secondary" data-opp-whatsapp="conversation">Ir a conversación</button><button type="button" class="primary" data-opp-whatsapp="message">Escribir WhatsApp</button>';slot.after(actions);
 const refresh=()=>{const p=window.TPFContactRelations?.opportunityPreview()||{},saved=editorOpportunity?party(editorOpportunity).recipient:null,recipient={phone:p.phone,name:p.recipient,id:saved?.id||null};bindActions(actions,editorOpportunity||{}, {recipient});};
 window.addEventListener('tpf:opportunity-party-preview',refresh);$('oppDetailModal').addEventListener('change',refresh);new MutationObserver(refresh).observe($('oppDetailModal'),{attributes:true,attributeFilter:['class']});refresh();
}
window.addEventListener?.('tpf:sales-updated',()=>{if(!$('opportunityFullPage')?.classList.contains('hidden')&&!$('oppFullContent')?.querySelector('.oppInlineForm')&&typeof window.openOpportunityFull==='function'){const id=$('oppFullContent')?.dataset.opportunityId;if(id)void window.openOpportunityFull(id);}});
window.TPFOpportunityDetails={fillEditor,readEditor,afterPrepare,decorateView,party,previous,operator,validDate,dateLabel};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',editorActions);else editorActions();
})();
