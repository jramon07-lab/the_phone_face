/* Opportunity contract metadata and explicit party navigation. No send side effects. */
(function(){
'use strict';
const $=id=>document.getElementById(id),text=v=>String(v||'').trim();
const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dates={terminal_commitment_end:'oppModalTerminalEnd',discount_end_date:'oppModalDiscountEnd'};
const dateLabel=v=>v?String(v).split('T')[0].split('-').reverse().join('/'):'Sin indicar';
function validDate(v){if(!v)return null;const d=new Date(v+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw Error('Indica una fecha válida.');return v;}
function party(o){
 const p=o.contract_party||{},same=p.same!==false,holder={id:p.holder_record_id||p.holder_contact_id||(same?o.record_id:null),name:p.holder_name||o.client_name||'Sin titular',phone:p.holder_phone||(same?o.phone:'')||''};
 const manager={id:p.manager_record_id||p.manager_contact_id||o.record_id,name:p.contact_name||(same?holder.name:'Sin gestor indicado'),phone:p.contact_phone||(same?holder.phone:o.phone)||''};
 const recipient={id:p.recipient_contact_id||(p.recipient==='holder'?holder.id:manager.id),name:p.recipient_name||(p.recipient==='holder'?holder.name:manager.name),phone:p.recipient_phone||(p.recipient==='holder'?holder.phone:manager.phone)||o.phone||''};
 return {holder,manager,recipient};
}
function operator(o){return text(o.installation_operator)||text((o.title||'').match(/vodafone|másmóvil|masmovil|orange|movistar|jazztel|yoigo|digi|o2|finetwork/i)?.[0])||'Sin indicar';}
function previous(o,i){return text(i?.previous_operator)||text(o.previous_operator)||text(o.after_sale_preferences?.previous_operator)||'Sin indicar';}
let editorToken=0,viewToken=0,editorOpportunity=null;
function fillEditor(o){
 editorOpportunity=o||null;const token=++editorToken;
 for(const [key,id]of Object.entries(dates))if($(id))$(id).value=o?.[key]||'';
 const input=$('oppModalPreviousOperator');if(input){input.value=o?previous(o)==='Sin indicar'?'':previous(o):'';input.readOnly=false;input.dataset.originalValue=input.value;}
 $('oppPreviousManage')?.setAttribute('hidden','');
 if($('oppPreviousHint'))$('oppPreviousHint').textContent='Compañía de la que viene el cliente.';
 if(o?.id)loadInstallation(o.id).then(i=>{
  if(token!==editorToken||text($('oppModalId')?.value)!==text(o.id)||!input||!i)return;
  input.value=previous(o,i)==='Sin indicar'?'':previous(o,i);input.readOnly=true;input.dataset.originalValue=input.value;
  $('oppPreviousManage').hidden=false;
  $('oppPreviousHint').textContent='Operador anterior de la instalación. Usa «Editar instalación / devolución» para cambiar sus instrucciones.';
  $('oppPreviousManage').onclick=()=>window.TPFInstallations?.manage(o.id);
  input.dispatchEvent(new Event('change',{bubbles:true}));
 }).catch(()=>{if(token===editorToken&&$('oppPreviousHint'))$('oppPreviousHint').textContent='No se pudo comprobar la instalación. Reabre la oportunidad antes de cambiar el operador anterior.';if(token===editorToken&&input)input.readOnly=true;});
}
function readEditor(payload){
 for(const [key,id]of Object.entries(dates))if($(id))payload[key]=validDate($(id).value);
 const input=$('oppModalPreviousOperator');
 if(input&&!input.readOnly){payload.previous_operator=text(input.value)||null;
  payload.after_sale_preferences={...(editorOpportunity?.after_sale_preferences||payload.after_sale_preferences||{}),previous_operator:payload.previous_operator||''};
 }
 return payload;
}
function afterPrepare(payload){if(payload.after_sale_preferences?.previous_operator)payload.previous_operator=payload.after_sale_preferences.previous_operator;return payload;}
async function loadInstallation(id){const r=await sb.from('crm_installations').select('previous_operator,appointment_date,installed_on,return_due_at').eq('opportunity_id',id).maybeSingle();if(r.error)throw r.error;return r.data;}
function bindActions(root,o,people){
 for(const button of root.querySelectorAll('[data-opp-person]')){const p=people[button.dataset.oppPerson];button.disabled=!p?.id;button.onclick=()=>{if(root.id==='oppFullContent')return window.returnToContactFromOpportunity(p.id,o.id);return window.openContact(p.id);};}
 for(const button of root.querySelectorAll('[data-opp-whatsapp]')){button.disabled=!text(people.recipient.phone);button.onclick=async()=>{try{await window.TPFLinkedActions.open(button.dataset.oppWhatsapp,{phone:people.recipient.phone,name:people.recipient.name,contactId:people.recipient.id});}catch(e){alert(e.message);}};}
}
function rolesHTML(people){return '<section class="oppContractPeople" aria-label="Titular, gestor y destinatario">'+[['holder','Titular del contrato'],['manager','Gestionado por'],['recipient','WhatsApp dirigido a']].map(([key,label])=>'<div class="oppContractPerson"><span>'+label+'</span><button type="button" class="oppContactLink" data-opp-person="'+key+'">'+esc(people[key].name)+'</button>'+(key==='recipient'?'<small>'+esc(people[key].phone||'Sin teléfono')+'</small>':'')+'</div>').join('')+'</section><div class="oppContractActions"><button type="button" class="secondary" data-opp-whatsapp="conversation">Ir a conversación</button><button type="button" class="primary" data-opp-whatsapp="message">Escribir WhatsApp</button></div>';}
async function decorateView(o){
 const token=++viewToken,root=$('oppFullContent');if(!root)return;
 const manage=$('oppFullManage');if(manage){manage.disabled=false;manage.onclick=async()=>{manage.disabled=true;try{if(typeof window.TPFHomeManage?.openOpportunity!=='function')throw Error('La gestión no está disponible. Actualiza la página.');await window.TPFHomeManage.openOpportunity(o.id);}catch(e){alert(e.message||'No se pudo abrir la gestión.');}finally{manage.disabled=false;}};}
 const people=party(o),old=root.querySelector('.oppContactSummary');if(old)old.outerHTML=rolesHTML(people);
 const metrics=root.querySelector('.oppSummaryMetrics');
 if(metrics)metrics.insertAdjacentHTML('beforeend','<div class="oppField"><span>Operador de la oferta</span><strong>'+esc(operator(o))+'</strong></div><div class="oppField"><span>Operador anterior</span><strong data-opp-previous>'+esc(previous(o))+'</strong></div><div class="oppField"><span>Fin de permanencia del terminal</span><strong>'+esc(dateLabel(o.terminal_commitment_end))+'</strong></div><div class="oppField"><span>Fin de descuento</span><strong>'+esc(dateLabel(o.discount_end_date))+'</strong></div>');
 bindActions(root,o,people);
 const next=document.createElement('section');next.className='oppField oppContractNext';next.innerHTML='<h3>Instalación y devolución</h3><p data-opp-installation>Comprobando la instalación…</p>';metrics?.after(next);
 try{const i=await loadInstallation(o.id);if(token!==viewToken||!root.contains(next))return;root.querySelector('[data-opp-previous]').textContent=previous(o,i);next.querySelector('p').textContent=i?.installed_on?'Instalada: '+dateLabel(i.installed_on):i?.appointment_date?'Cita de instalación: '+dateLabel(i.appointment_date):'Sin cita de instalación registrada.';
  if(i?.return_due_at)next.querySelector('p').textContent+=' · Devolución prevista: '+new Date(i.return_due_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'});
 }catch(e){if(token===viewToken&&root.contains(next))next.querySelector('p').textContent='No se pudo comprobar la instalación. Las fechas del contrato siguen visibles.';}
}
function editorActions(){
 const slot=$('crmOpportunityPartySlot');if(!slot||slot.querySelector('.oppContractActions'))return;
 const actions=document.createElement('div');actions.className='oppContractActions';actions.innerHTML='<button type="button" class="secondary" data-opp-whatsapp="conversation">Ir a conversación</button><button type="button" class="primary" data-opp-whatsapp="message">Escribir WhatsApp</button>';slot.after(actions);
 const refresh=()=>{const p=window.TPFContactRelations?.opportunityPreview()||{},saved=editorOpportunity?party(editorOpportunity).recipient:null,recipient={phone:p.phone,name:p.recipient,id:saved?.id||null};bindActions(actions,editorOpportunity||{}, {recipient});};
 window.addEventListener('tpf:opportunity-party-preview',refresh);$('oppDetailModal').addEventListener('change',refresh);new MutationObserver(refresh).observe($('oppDetailModal'),{attributes:true,attributeFilter:['class']});refresh();
}
window.TPFOpportunityDetails={fillEditor,readEditor,afterPrepare,decorateView,party,previous,operator,validDate,dateLabel};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',editorActions);else editorActions();
})();
