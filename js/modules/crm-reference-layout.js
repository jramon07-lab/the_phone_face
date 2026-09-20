/* Presentation adapters only. Adopt existing nodes; never clone form controls or call a data API. */
(function(){
'use strict';
if(!document.body.classList.contains('tpfUnified'))return;
const $=id=>document.getElementById(id);
const paths={dashboard:'M3 10 12 3l9 7v11H3Z M9 21v-8h6v8',alerts:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',search:'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',sales:'M4 20V12 M10 20V4 M16 20V8 M22 20V2',database:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M18 3a4 4 0 0 1 0 8',agenda:'M3 5h18v16H3Z M7 2v6 M17 2v6 M3 11h18',whatsapplive:'M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4c0 4-9 2-14-3S1 3 5 3Z',email:'M3 5h18v14H3Z M3 6l9 7 9-7',labels:'M3 3h9l9 9-9 9-9-9Z M7 7h.01',settings:'M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',automations:'M12 3v7 M4 14v7 M20 14v7 M4 14h16 M12 10v4',whatsapp:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',import:'M12 16V3 M7 8l5-5 5 5 M3 15v6h18v-6',trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',system:'M3 12h4l3-8 4 16 3-8h4'};
function icons(){document.querySelectorAll('.referenceNav .nav[data-view]').forEach(node=>{const slot=node.querySelector('b');if(!slot||slot.querySelector('svg'))return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[node.dataset.view]||'M6 2h8l5 5v15H6Z M14 2v6h5 M9 12h7 M9 16h7');svg.append(path);slot.replaceChildren(svg);});}
const nav=document.querySelector('.referenceNav');if(nav){icons();new MutationObserver(icons).observe(nav,{childList:true,subtree:true});}
function dockTestBadge(){
 const badge=$('tpfTestMode');if(!badge)return;
 const editor=$('tpfContactsCreateBack'),opp=$('oppDetailModal');
 const target=editor&&!editor.classList.contains('hidden')?editor.querySelector('.tpfContactsModalHead'):opp&&!opp.classList.contains('hidden')?opp.querySelector('.opportunityModalHeader'):null;
 if(target){if(badge.parentElement!==target)target.insertBefore(badge,target.lastElementChild);if(!badge.classList.contains('tpfTestModeDocked'))badge.classList.add('tpfTestModeDocked');badge.title='CRM de pruebas · WhatsApp limitado al teléfono de pruebas';}
 else{if(badge.parentElement!==document.body)document.body.append(badge);badge.classList.remove('tpfTestModeDocked');}
}
new MutationObserver(records=>{if(records.some(r=>['oppDetailModal','tpfContactsCreateBack'].includes(r.target.id)||[...(r.addedNodes||[])].some(n=>n.id==='tpfTestMode')))dockTestBadge();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});dockTestBadge();
function opportunity(){
 const modal=$('oppDetailModal'),card=modal?.querySelector('.opportunityModalCard');if(!card||card.querySelector('.crmOpportunityLayout'))return;
 const layout=document.createElement('div');layout.className='crmOpportunityLayout';
 const main=document.createElement('div');main.className='crmOpportunityMain';
 const aside=document.createElement('aside');aside.className='crmOpportunityAside';aside.setAttribute('aria-label','Resumen e información del contacto');
 const summary=document.createElement('section');summary.className='crmOpportunitySummary';
 summary.innerHTML='<h3>Resumen de la oportunidad</h3><div class="crmSummaryTop"><div class="crmSummaryAmount" data-crm-summary="amount"></div><span class="crmSummaryStage" data-crm-summary="stage"></span></div><dl><dt>Titular del contrato</dt><dd><span data-crm-summary="holder"></span><small data-crm-summary="holderNickname"></small></dd><dt>DNI / NIF</dt><dd data-crm-summary="dni"></dd><dt>Gestionado por</dt><dd><span data-crm-summary="manager"></span><small data-crm-summary="managerNickname"></small></dd><dt>WhatsApp dirigido a</dt><dd data-crm-summary="recipient"></dd><dt>Teléfono WhatsApp</dt><dd data-crm-summary="phone"></dd><dt>Fecha prevista</dt><dd data-crm-summary="date"></dd></dl><div class="crmSummaryNotes"><h4>Notas de la oportunidad</h4><p data-crm-summary="notes"></p><button type="button" class="secondary" data-crm-expand hidden aria-expanded="false">Ver completas</button></div><p class="crmSummaryPending" data-crm-pending hidden>Pendiente de guardar</p>';
 const contactCard=document.createElement('section');contactCard.className='crmOpportunityContact';contactCard.setAttribute('aria-label','Información del contacto');
 contactCard.innerHTML='<div class="crmContextHeading"><h3>Información del contacto</h3><button type="button" class="secondary" data-crm-contact-edit>Editar contacto</button></div><div class="crmContextTabs" data-crm-contact-tabs></div><div class="crmContextIdentity"><strong data-crm-contact="name"></strong><span data-crm-contact="nickname"></span><small data-crm-contact="role"></small></div><p data-crm-contact-state></p><div data-crm-contact-body hidden><section class="crmContextText"><h4>Observaciones del contacto <small>Protegidas</small></h4><p data-crm-contact="observations"></p></section><section class="crmContextText"><h4>Notas de su ficha <small>Protegidas</small></h4><p data-crm-contact="notes"></p></section><p class="crmContextEditHint">Usa «Editar contacto» para cambiar sus datos, notas, observaciones y etiquetas.</p><button type="button" class="crmContextOpen">Abrir ficha del contacto ↗</button><div class="crmContextExtras" data-crm-contact-extras></div></div>';
 aside.append(summary,contactCard);layout.append(main,aside);
 const sections=[...card.querySelectorAll(':scope > .opportunitySection')];if(!sections.length)return;
 sections[0].before(layout);sections.forEach(n=>main.append(n));
 const notes=$('oppModalNotes'),notesLabel=notes.closest('label'),notesSection=document.createElement('section');notesSection.className='opportunitySection crmOpportunityNotes';
 const notesTitle=document.createElement('h3');notesTitle.className='opportunitySectionTitle';notesTitle.textContent='Notas de esta oportunidad';notesSection.append(notesTitle,notesLabel);main.insertBefore(notesSection,sections[1]||null);
 notesLabel.firstChild.textContent='Anotaciones sobre esta venta';notes.placeholder='Escribe aquí lo que necesitas recordar sobre esta oportunidad…';notes.rows=2;
 const notesActions=document.createElement('div');notesActions.className='crmNotesActions';notesActions.innerHTML='<button type="button" class="secondary" data-crm-notes-edit>Editar notas</button><button type="button" class="secondary" data-crm-notes-cancel hidden>Cancelar edición</button><span data-crm-notes-hint>Notas protegidas</span>';
 const notesHeading=document.createElement('div');notesHeading.className='crmNotesHeading';notesTitle.before(notesHeading);notesHeading.append(notesTitle,notesActions);const notesMessage=document.createElement('p');notesMessage.className='crmEditMessage';notesMessage.setAttribute('role','alert');notesMessage.hidden=true;notesSection.append(notesMessage);
 const notesEdit=notesActions.querySelector('[data-crm-notes-edit]'),notesCancel=notesActions.querySelector('[data-crm-notes-cancel]');
 const resizeNotes=()=>{notes.style.height='auto';notes.style.height=Math.max(46,Math.min(notes.scrollHeight,150))+'px';};
 const syncNotesProtection=()=>{const locked=notes.dataset.notesProtected==='true';resizeNotes();notesEdit.hidden=!locked;notesEdit.textContent=notes.value?'Editar notas':'Añadir notas';notesCancel.hidden=locked;notesActions.querySelector('[data-crm-notes-hint]').textContent=locked?'Notas protegidas':'Edición activada · guarda al terminar';};
 notesEdit.onclick=()=>{window.TPFOpportunityNotes?.protect(notes,false);syncNotesProtection();notes.focus();};
 notesCancel.onclick=()=>{window.TPFOpportunityNotes?.restore(notes);notesMessage.hidden=true;syncNotesProtection();update();};
 modal.addEventListener('click',e=>{if(!e.target.closest('#oppModalSave'))return;const error=window.TPFOpportunityNotes?.validate(notes);if(error){e.preventDefault();e.stopImmediatePropagation();notesMessage.textContent=error;notesMessage.hidden=false;notes.focus();}},true);
 notes.addEventListener('input',()=>{notesMessage.hidden=true;resizeNotes();});
 const parties=document.createElement('section');parties.className='opportunitySection crmOpportunityParties';
 const partySlot=document.createElement('div');partySlot.id='crmOpportunityPartySlot';parties.append(partySlot);notesSection.after(parties);
 const existingParty=$('tpfOpportunityParty');if(existingParty)partySlot.append(existingParty);
 const picker=document.createElement('details');picker.className='crmOpportunityContactPicker';picker.innerHTML='<summary>Contacto vinculado / buscar otro</summary><div class="crmOpportunityLinkedFields"></div>';parties.append(picker);
 for(const id of ['oppModalClient','oppModalPhone','oppModalDni'])picker.lastElementChild.append($(id).closest('label'));
 $('oppModalClient').closest('label').firstChild.textContent='Nombre del contacto vinculado';
 const activity=document.createElement('details');activity.className='crmOpportunityActivity';
 activity.innerHTML='<summary>Actividad y origen</summary><div class="crmOpportunityActivityBody"><p data-crm-origin hidden></p></div>';
 main.append(activity);const meta=$('oppMetaInfo');if(meta)activity.querySelector('div').append(meta);
 const header=card.querySelector('.opportunityModalHeader'),badges=document.createElement('div');badges.className='crmOpportunityHeaderMetrics';badges.innerHTML='<strong data-crm-header="amount"></strong><span data-crm-header="stage"></span>';header.querySelector('div').append(badges);
 header.querySelector('.opportunityEyebrow').textContent='Panel de ventas / Oportunidad';
 const footer=card.querySelector('.opportunityActions'),deleteButton=$('oppModalDelete');footer.prepend(deleteButton);deleteButton.classList.add('crmOpportunityDelete');
 deleteButton.insertAdjacentHTML('afterbegin','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>');
 $('oppModalClose').hidden=false;$('oppModalClose').textContent='Cancelar';footer.insertBefore($('oppModalClose'),$('oppModalSave'));
 const status=document.createElement('span');status.className='crmOpportunitySaveState';status.setAttribute('role','status');footer.insertBefore(status,$('oppModalClose'));
 const fields=['oppModalTitle','oppModalClient','oppModalPhone','oppModalAmount','oppModalDate','oppModalStage','oppModalNotes'];
 const fingerprint=()=>JSON.stringify(fields.map(id=>$(id)?.value||''));let baseline='',wasOpen=false,openedId='',selectedContact='',contactSignature='',extrasKey='',generation=0;
 const extrasCache=new Map();
 const setText=(node,value)=>{if(node&&node.textContent!==String(value))node.textContent=String(value);};
 const tones={'próximo':'future','este mes':'current','seguimiento':'followup','pendiente de tramitar':'pending','tramitado':'processed','ganado':'won','perdido':'lost'};
 const expand=summary.querySelector('[data-crm-expand]'),notePreview=summary.querySelector('[data-crm-summary="notes"]');
 expand.onclick=()=>{const expanded=expand.getAttribute('aria-expanded')!=='true';expand.setAttribute('aria-expanded',String(expanded));notePreview.classList.toggle('expanded',expanded);expand.textContent=expanded?'Ver menos':'Ver completas';};
 const contextEdit=contactCard.querySelector('[data-crm-contact-edit]');
 const editMessage=document.createElement('p');editMessage.className='crmEditMessage';editMessage.setAttribute('role','alert');editMessage.hidden=true;contactCard.querySelector('.crmContextHeading').after(editMessage);
 contextEdit.onclick=async()=>{contextEdit.disabled=true;editMessage.hidden=true;try{await window.TPFOpportunityContext.editContact(selectedContact);}catch(e){editMessage.textContent=e.message;editMessage.hidden=false;}finally{contextEdit.disabled=false;}};
 const contextOpen=contactCard.querySelector('.crmContextOpen');
 contextOpen.onclick=()=>{if(selectedContact&&typeof window.openContact==='function')window.openContact(selectedContact);};
 function paintExtras(data){
  const out=contactCard.querySelector('[data-crm-contact-extras]');out.replaceChildren();
  const labelTitle=document.createElement('h4');labelTitle.textContent='Etiquetas del contacto';out.append(labelTitle);
  const tags=document.createElement('div');tags.className='crmContextTags';out.append(tags);
  if(data.labelsError)tags.textContent='No se pudieron cargar las etiquetas.';
  else if(!data.labels.length)tags.textContent='Sin etiquetas';
  else for(const label of data.labels){const tag=document.createElement('span');tag.textContent=label.name;tags.append(tag);}
  const taskBox=document.createElement('details');taskBox.className='crmContextTasks';
  const taskHeading=document.createElement('summary');taskHeading.textContent=data.tasksError?'Tareas pendientes · No disponibles':'Tareas pendientes · '+data.taskCount;taskBox.append(taskHeading);
  const help=document.createElement('p');help.textContent=data.tasksError?'No se pudieron cargar las tareas.':'Tareas vinculadas a esta ficha.';taskBox.append(help);
  for(const task of data.tasks){const row=document.createElement('div');row.className='crmContextTask';const title=document.createElement('strong');title.textContent=task.title||'Tarea';const date=document.createElement('span');date.textContent=task.starts_at?new Date(task.starts_at).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Sin fecha';row.append(title,date);taskBox.append(row);}
  const open=document.createElement('button');open.type='button';open.textContent='Ver tareas en su ficha ↗';open.className='crmContextOpen';open.onclick=contextOpen.onclick;taskBox.append(open);out.append(taskBox);
  if(data.labelsError||data.tasksError){const retry=document.createElement('button');retry.type='button';retry.className='crmContextOpen';retry.textContent='Reintentar';retry.onclick=()=>{extrasCache.delete(selectedContact);extrasKey='';update();};out.append(retry);}
 }
 async function updateExtras(id){
  const key=openedId+'|'+id;if(extrasKey===key)return;extrasKey=key;const token=generation;
  const out=contactCard.querySelector('[data-crm-contact-extras]');out.textContent='Cargando etiquetas y tareas…';
  try{
   let request=extrasCache.get(id);if(!request){request=window.TPFOpportunityContext.loadExtras(sb,id);extrasCache.set(id,request);}
   const data=await request;if(token!==generation||extrasKey!==key||modal.classList.contains('hidden'))return;paintExtras(data);
  }catch(e){if(token!==generation||extrasKey!==key)return;paintExtras({labels:[],tasks:[],taskCount:0,labelsError:true,tasksError:true});}
 }
 function updateContact(info,people){
  const contacts=people.contacts||[],signature=contacts.map(x=>x.id).join('|');
  if(!contacts.some(x=>x.id===selectedContact))selectedContact=contacts[0]?.id||'';
  const tabs=contactCard.querySelector('[data-crm-contact-tabs]');
  if(signature!==contactSignature){contactSignature=signature;tabs.replaceChildren();if(contacts.length>1)for(const person of contacts){const button=document.createElement('button');button.type='button';button.textContent=person.role;button.dataset.contactContext=person.id;button.onclick=()=>{selectedContact=person.id;update();};tabs.append(button);}}
  tabs.hidden=contacts.length<2;for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.contactContext===selectedContact));
  const current=contacts.find(x=>x.id===selectedContact),state=contactCard.querySelector('[data-crm-contact-state]'),body=contactCard.querySelector('[data-crm-contact-body]');
  state.hidden=!!current;body.hidden=!current;contextEdit.hidden=!current;
  setText(state,info.error?'No se pudieron cargar los datos del contacto.':info.loading?'Comprobando la ficha vinculada…':'Vincula un contacto para consultar sus notas y observaciones.');
  for(const key of ['name','nickname','role','notes','observations'])setText(contactCard.querySelector('[data-crm-contact="'+key+'"]'),current?.[key]||(key==='notes'?'Sin notas en su ficha.':key==='observations'?'Sin observaciones.':''));
  contactCard.querySelector('[data-crm-contact="nickname"]').hidden=!current?.nickname;
  if(current)updateExtras(current.id);else{extrasKey='';contactCard.querySelector('[data-crm-contact-extras]').replaceChildren();}
 }
 function update(){
  if(modal.classList.contains('hidden'))return;
  const info=window.TPFContactRelations?.opportunityPreview()||{},people=window.TPFContactRelations?.opportunityContacts()||{contacts:[]},amountInput=$('oppModalAmount')?.value,amount=amountInput!==''&&Number.isFinite(Number(amountInput))?Number(amountInput).toLocaleString('es-ES',{style:'currency',currency:'EUR'}):'Sin importe';
  const stage=$('oppModalStage')?.selectedOptions?.[0]?.textContent||'Sin estado';
  const values={holder:info.loading?'Comprobando…':info.holder||$('oppModalClient')?.value||'Sin titular',holderNickname:people.holder?.nickname||'',dni:info.loading?'—':info.dni||'Sin indicar',manager:info.loading?'Comprobando…':info.manager||'El propio titular',managerNickname:people.manager?.nickname||'',recipient:info.loading?'Comprobando…':info.recipient||'Sin indicar',phone:info.loading?'—':window.TPFContactParty?.displayPhone(info.phone)||info.phone||'Sin teléfono',amount,date:$('oppModalDate')?.value?$('oppModalDate').value.split('-').reverse().join('/'):'Sin fecha',stage,notes:notes.value||'Aún no hay notas de esta oportunidad.'};
  for(const [key,value]of Object.entries(values))setText(summary.querySelector('[data-crm-summary="'+key+'"]'),value);
  for(const key of ['holderNickname','managerNickname'])summary.querySelector('[data-crm-summary="'+key+'"]').hidden=!values[key];
  const recipientNode=summary.querySelector('[data-crm-summary="recipient"]'),sameRecipient=values.recipient===values.manager||values.recipient===values.holder;recipientNode.hidden=sameRecipient;recipientNode.previousElementSibling.hidden=sameRecipient;
  setText(header.querySelector('[data-crm-header="amount"]'),amount);setText(header.querySelector('[data-crm-header="stage"]'),stage);
  const tone=tones[stage.trim().toLowerCase()]||'neutral';summary.querySelector('[data-crm-summary="stage"]').dataset.tone=tone;header.querySelector('[data-crm-header="stage"]').dataset.tone=tone;
  const pending=fingerprint()!==baseline||!!info.pending;summary.querySelector('[data-crm-pending]').hidden=!pending;
  setText(status,info.error?'No se pudieron comprobar los titulares':info.loading?'Comprobando titulares…':pending?'Cambios sin guardar':$('oppModalId').value?'Sin cambios pendientes':'Nueva oportunidad');
  status.classList.toggle('pending',pending);expand.hidden=notes.value.length<180&&notes.value.split('\n').length<4;
  const origin=window.TPFOpportunityNotes?.split(notes.dataset.originalNotes||'').origin||'';const originNode=activity.querySelector('[data-crm-origin]');originNode.hidden=!origin;setText(originNode,origin||'');
  deleteButton.hidden=!$('oppModalId').value;updateContact(info,people);
 }
 function opened(){const open=!modal.classList.contains('hidden');if(open&&(!wasOpen||openedId!==$('oppModalId').value)){openedId=$('oppModalId').value;baseline=fingerprint();generation++;window.TPFOpportunityNotes?.protect(notes);syncNotesProtection();notesMessage.hidden=true;editMessage.hidden=true;selectedContact='';extrasKey='';extrasCache.clear();activity.open=false;picker.open=!$('oppModalOpenContact').dataset.recordId;expand.setAttribute('aria-expanded','false');notePreview.classList.remove('expanded');expand.textContent='Ver completas';layout.scrollTop=0;}if(!open&&wasOpen){generation++;extrasKey='';}wasOpen=open;update();}
 card.addEventListener('input',update);card.addEventListener('change',update);window.addEventListener('tpf:opportunity-party-preview',update);
 window.addEventListener('tpf:contact-updated',()=>{extrasCache.clear();extrasKey='';generation++;update();});
 new MutationObserver(opened).observe(modal,{attributes:true,attributeFilter:['class']});opened();
}
opportunity();
const settings=$('view-settings');
if(settings){
 const layout=document.createElement('div');layout.className='crmSettingsLayout';
 const nav=document.createElement('nav');nav.className='crmSettingsNav';nav.setAttribute('aria-label','Secciones de configuración');
 const content=document.createElement('div');content.className='crmSettingsContent';layout.append(nav,content);
 const cards=[...settings.children].filter(n=>n.classList.contains('card'));if(cards.length>1){cards[0].after(layout);cards.slice(1).forEach(n=>content.append(n));}
 let scheduled=false;
 function refresh(){scheduled=false;if(!layout.isConnected)return;[...settings.children].filter(n=>n!==cards[0]&&n.classList.contains('card')).forEach(n=>content.append(n));const sections=[...content.children].filter(n=>n.matches('.card'));const signature=sections.map(n=>n.querySelector('h2,h3')?.textContent||'').join('|');if(nav.dataset.signature===signature)return;nav.dataset.signature=signature;nav.replaceChildren();sections.forEach((section,i)=>{const title=section.querySelector('h2,h3');if(!title)return;if(!section.id)section.id='crm-settings-section-'+i;const a=document.createElement('a');a.href='#'+section.id;a.textContent=title.textContent;a.addEventListener('click',e=>{e.preventDefault();section.scrollIntoView({behavior:'auto',block:'start'});});nav.append(a);});}
 new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(refresh);}}).observe(settings,{childList:true,subtree:true});refresh();
}
})();
