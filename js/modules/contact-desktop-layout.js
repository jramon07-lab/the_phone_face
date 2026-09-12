(function(){
 'use strict';
 // Presentation only: reparent existing nodes, preserving their handlers and values.
 const modal=document.getElementById('contactModal');
 if(!modal)return;
 const $=id=>document.getElementById(id),mq=window.matchMedia('(min-width:1024px)');
 const profile=modal.querySelector('.contactProfile'),columns=modal.querySelector('.cpColumns');
 const identity=modal.querySelector('.cpIdentity'),center=modal.querySelector('.cpCenter');
 const left=modal.querySelector('.cpLeft'),right=modal.querySelector('.cpRight');
 if(!profile||!columns||!identity||!center||!left||!right)return;
 const identityAnchor=document.createComment('desktop identity original position');
 const centerAnchor=document.createComment('desktop history original position');
 identity.before(identityAnchor);center.before(centerAnchor);
 const heading=modal.querySelector('.cpNav'),oldHeading=heading?.textContent;
 let mounted=false,selected='resumen';
 const composer=$('agendaCreateCard'),typeModal=$('agendaTypeModal');
 let embeddedCreate=false,tabBeforeCreate='resumen',composerPositions=[],composerChildren=[],taskDialog=null,taskTrigger=null,contactWasInert=false;
 function restoreComposer(){
  if(!embeddedCreate)return;
  embeddedCreate=false;
  composerChildren=[];composer.removeAttribute('data-contact-dialog');
  taskDialog?.remove();taskDialog=null;modal.inert=contactWasInert;
  composerPositions.splice(0).forEach(({node,parent,next})=>parent.insertBefore(node,next?.parentNode===parent?next:null));
  typeModal?.removeAttribute('data-contact-composer');
  modal.classList.remove('cpRefTaskInside');select(tabBeforeCreate);taskTrigger?.focus();taskTrigger=null;
 }
 const tabs=document.createElement('div');tabs.className='cpRefTabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Información del cliente');
 const panels=[
  ['resumen','Resumen'],['oportunidades','Oportunidades'],['tareas','Tareas'],['notas','Notas'],['documentos','Documentos'],['historial','Historial']
 ];
 panels.forEach(([key,label])=>{
  const b=document.createElement('button');b.type='button';b.id='cpRefTab-'+key;b.dataset.cpRefTab=key;b.textContent=label;b.setAttribute('role','tab');b.setAttribute('aria-controls','cpRefPanel');tabs.appendChild(b);
 });
 const panel=document.createElement('div');panel.id='cpRefPanel';panel.setAttribute('role','tabpanel');panel.tabIndex=0;
 const notes=document.createElement('section');notes.id='cpNotesPanel';notes.className='cpSideSection';right.appendChild(notes);
 const sections=[...right.children];sections.forEach(section=>{
  section.dataset.cpRefPane=section.id==='cpOffersSection'?'ofertas':section.id==='cpAutomationStatus'?'automatizaciones':section.contains($('cpOpportunities'))?'oportunidades':section.contains($('cpTasks'))?'tareas':section.contains($('cpWhatsappPrograms'))?'programados':section.id==='cpDocumentsPending'?'documentos':'informacion';
 });
 // Modules can mount after this layout. Adopt their existing nodes, never clone them.
 function summaryCount(selector,root){return root?root.querySelectorAll(selector).length:0;}
 function summaryText(node){return String(node?.textContent||'').toLowerCase();}
 function summaryMetrics(key){
  const opp=$('cpOpportunities'),tasks=$('cpTasks'),programs=$('cpWhatsappPrograms'),offers=$('cpOffersSection');
  if(key==='work'){
   const total=Number($('cpOppTotal')?.textContent||summaryCount(':scope > .oppUnifiedCard',opp))||0;
   const open=Number($('cpOppOpen')?.textContent||0)||0,expired=Number($('cpOppExpired')?.textContent||0)||0;
   const cards=[...tasks?.querySelectorAll(':scope > .cpTaskWrap')||[]];
   const completed=cards.filter(x=>/completada|completado/.test(summaryText(x))).length;
   const overdue=cards.filter(x=>/vencida|vencido/.test(summaryText(x))).length;
   return 'Oportunidades: '+total+' total · '+open+' abiertas · '+expired+' vencidas  |  Tareas: '+cards.length+' total · '+Math.max(0,cards.length-completed)+' pendientes · '+overdue+' vencidas · '+completed+' completadas';
  }
  if(key==='programs'){
   const total=summaryCount(':scope > .cpWaWrap',programs);
   return total+' WhatsApp programado'+(total===1?'':'s');
  }
  const cards=[...offers?.querySelectorAll('.cpOfferCard,.cpOfferItem')||[]];
  const rows=cards.length?cards:[...offers?.querySelectorAll('.cpOfferList > *')||[]];
  const active=rows.filter(x=>/seguimiento activo/.test(summaryText(x))).length;
  const paused=rows.filter(x=>/seguimiento pausado/.test(summaryText(x))).length;
  const processed=rows.filter(x=>/tramitado/.test(summaryText(x))).length;
  return rows.length+' oferta'+(rows.length===1?'':'s')+' · '+active+' activas · '+paused+' pausadas · '+processed+' tramitadas';
 }
 function setSummaryMetric(block,text){
  const metric=block?.querySelector('.tpfSummaryMetric');if(metric&&metric.textContent!==text)metric.textContent=text;
 }
 function restoreSummaryGroups(){
  const root=panel.querySelector('#tpfSummaryAccordion');if(!root)return;
  [...root.querySelectorAll('[data-cp-ref-pane]')].forEach(section=>panel.appendChild(section));
  root.remove();
 }
 function makeSummaryGroup(root,key,title,items){
  const existing=root.querySelector('[data-tpf-summary-group="'+key+'"]');
  if(existing){setSummaryMetric(existing,summaryMetrics(key));return existing;}
  const block=document.createElement('section');block.className='tpfSummaryGroup';block.dataset.tpfSummaryGroup=key;block.dataset.tpfOpen='false';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='tpfSummaryTrigger';trigger.setAttribute('aria-expanded','false');
  const label=document.createElement('span');label.className='tpfSummaryTitle';label.textContent=title;
  const metric=document.createElement('small');metric.className='tpfSummaryMetric';
  const arrow=document.createElement('span');arrow.className='tpfSummaryChevron';arrow.setAttribute('aria-hidden','true');arrow.textContent='⌄';
  trigger.append(label,metric,arrow);
  const body=document.createElement('div');body.className='tpfSummaryBody';
  items.filter(Boolean).forEach(item=>body.appendChild(item));
  trigger.addEventListener('click',()=>{const open=block.dataset.tpfOpen!=='true';block.dataset.tpfOpen=String(open);trigger.setAttribute('aria-expanded',String(open));});
  block.append(trigger,body);root.appendChild(block);setSummaryMetric(block,summaryMetrics(key));return block;
 }
 function applySummaryGroups(){
  if(!mounted||selected!=='resumen'){restoreSummaryGroups();return;}
  const root=panel.querySelector('#tpfSummaryAccordion')||document.createElement('div');
  root.id='tpfSummaryAccordion';root.className='tpfSummaryAccordion';
  if(!root.parentElement)panel.prepend(root);
  const opp=sections.find(s=>s.dataset.cpRefPane==='oportunidades'),tasks=sections.find(s=>s.dataset.cpRefPane==='tareas'),programs=sections.find(s=>s.dataset.cpRefPane==='programados');
  const offers=sections.find(s=>s.dataset.cpRefPane==='ofertas'),automation=sections.find(s=>s.dataset.cpRefPane==='automatizaciones');
  makeSummaryGroup(root,'work','Oportunidades y tareas pendientes',[opp,tasks]);
  makeSummaryGroup(root,'programs','WhatsApp programados',[programs]);
  makeSummaryGroup(root,'offers','Ofertas y seguimiento',[offers,automation]);
 }
 function refreshSummaryMetrics(){
  panel.querySelectorAll('[data-tpf-summary-group]').forEach(block=>setSummaryMetric(block,summaryMetrics(block.dataset.tpfSummaryGroup)));
 }
 function syncSummarySections(){
  for(const [id,key] of [['cpOffersSection','ofertas'],['cpAutomationStatus','automatizaciones']]){
   const section=$(id);if(!section||!modal.contains(section))continue;
   if(section.dataset.cpRefPane!==key)section.dataset.cpRefPane=key;
   if(!sections.includes(section))sections.push(section);
   const target=mounted?panel:right;
   const grouped=mounted&&selected==='resumen'&&section.closest('#tpfSummaryAccordion');
   if(section.parentElement!==target&&!grouped)target.appendChild(section);
  }
 }
 center.dataset.cpRefPane='historial';
 notes.dataset.cpRefPane='notas';
 const docs=$('cpDocumentsPending');
 if(docs){
  docs.innerHTML='<div class="cpRefDrive"><strong>Google Drive</strong><span class="cpPendingBadge">Pendiente de conectar</span></div><div class="cpRefDocActions"><button type="button" disabled>Subir archivos</button><button type="button" disabled>Escanear / Crear PDF</button><button type="button" disabled>Abrir en Drive</button></div><div class="cpRefDocumentEmpty"><span class="cpRefDocumentIcon" aria-hidden="true">▤</span><h3 id="cpDocumentsTitle">Documentos del cliente</h3><p>La conexión con Google Drive todavía está pendiente.</p><p>Podrás vincular una carpeta existente y reunir aquí los PDF y fotografías de este cliente.</p><span>Subida de archivos y escaneo de DNI: pendientes</span></div>';
 }
 const expiry=document.createElement('section');expiry.className='cpRefExpiry';expiry.innerHTML='<h3>Caducidad del DNI</h3><span class="cpPendingBadge">Pendiente</span><p>Lectura y confirmación de la fecha todavía no disponibles.</p>';
 const edit=document.createElement('button');edit.type='button';edit.className='cpRefEdit';edit.textContent='Editar datos';
 edit.addEventListener('click',()=>{$('tpfContactEditToggle')?.click();});
 const call=document.createElement('a');call.className='cpRefCall';call.textContent='Llamar';
 function updateCall(){
  const number=String($('contactPhone')?.value||'').trim().replace(/[^\d+]/g,'');
  if(number&&/\d{6}/.test(number)){call.href='tel:'+number;call.removeAttribute('aria-disabled');}
  else{call.removeAttribute('href');call.setAttribute('aria-disabled','true');}
 }
 function select(key,focus=false){
  if(!panels.some(([k])=>k===key))return;
  selected=key;right.dataset.cpRefSelected=key;
  tabs.querySelectorAll('button').forEach(b=>{const on=b.dataset.cpRefTab===key;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus();});
  panel.setAttribute('aria-labelledby','cpRefTab-'+key);
  applySummaryGroups();refreshSummaryMetrics();
 }
 tabs.addEventListener('click',e=>{const b=e.target.closest('[data-cp-ref-tab]');if(b)select(b.dataset.cpRefTab);});
 tabs.addEventListener('keydown',e=>{
  const keys=panels.map(([k])=>k);let i=keys.indexOf(selected);
  if(e.key==='ArrowRight')i=(i+1)%keys.length;else if(e.key==='ArrowLeft')i=(i+keys.length-1)%keys.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=keys.length-1;else return;
  e.preventDefault();select(keys[i],true);
 });
 function taskMode(){
  if(embeddedCreate)return false;
  return ['tpfTaskStandalone','tpfListTaskModal','tpf-wa-task-mode','tpf-wa-task-flow'].some(c=>modal.classList.contains(c)) ||
   ['cpTaskPage','cpTaskDetailPage','tpfWaTasksPage'].some(id=>{const e=$(id);return e&&!e.classList.contains('hidden');});
 }
 function sync(){
  if(embeddedCreate&&(!mq.matches||modal.classList.contains('hidden'))){
   window.TPFAgendaComposer?.close({silent:true});restoreComposer();
  }
  edit.textContent=modal.classList.contains('tpf-contact-editing')?'Cancelar edición':'Editar datos';
  const on=mq.matches&&!taskMode();
  if(on&&!mounted){
   mounted=true;if(heading)heading.textContent='Ficha del cliente';
   columns.before(identity);
   sections.forEach(s=>panel.appendChild(s));panel.appendChild(center);right.append(tabs,panel);
   left.appendChild(expiry);identity.querySelector('.cpQuick')?.prepend(call);
   modal.querySelector('.cpTop')?.appendChild(edit);
   modal.classList.add('tpfContactReference');select(selected);updateCall();
  }else if(!on&&mounted){
   mounted=false;photoEpoch++;closePhotoModal();clearPhotoReady();avatar?.querySelector('.cpRefPhoto')?.remove();if(heading)heading.textContent=oldHeading;modal.classList.remove('tpfContactReference');
   identityAnchor.after(identity);centerAnchor.after(center);
   sections.forEach(s=>right.appendChild(s));tabs.remove();panel.remove();expiry.remove();edit.remove();call.remove();
  }
  syncSummarySections();applySummaryGroups();refreshSummaryMetrics();
 }
 document.addEventListener('click',e=>{
  if(!mounted||modal.classList.contains('hidden')||!composer||typeof window.openAgendaComposer!=='function')return;
  if(!e.target.closest?.('#cpNewTask,#cpSideNewTask'))return;
  e.preventDefault();e.stopImmediatePropagation();if(embeddedCreate)return;
  let contact=null;try{contact=typeof currentContact!=='undefined'?currentContact:null;}catch(_){}
  if(!contact?.id)return;
  const contactId=contact.id;
  tabBeforeCreate=selected;embeddedCreate=true;
  taskTrigger=e.target.closest('#cpNewTask,#cpSideNewTask');
  contactWasInert=modal.inert;modal.inert=true;
  modal.classList.add('cpRefTaskInside');select('tareas');
  window.openAgendaComposer({customerName:$('contactName')?.value||'',phone:$('contactPhone')?.value||'',contactId,type:'Tarea'}, {
   onCancel:restoreComposer,
   onSaved:async row=>{restoreComposer();if(row?.related_record_id&&typeof logContactActivity==='function')await logContactActivity(row.related_record_id,'task_created','Tarea creada',row.title||'');if(typeof currentContact!=='undefined'&&currentContact?.id===contactId&&typeof renderContactProfile==='function')await renderContactProfile();}
  });
 },true);
 // The contact back button closes its child composer before leaving the client.
 window.addEventListener('click',e=>{
  if(!embeddedCreate||!e.target.closest?.('#contactClose'))return;
  e.preventDefault();e.stopImmediatePropagation();window.TPFAgendaComposer?.close();
 },true);
 const observer=new MutationObserver(sync);observer.observe(modal,{attributes:true,attributeFilter:['class']});
 ['cpTaskPage','cpTaskDetailPage'].forEach(id=>{if($(id))observer.observe($(id),{attributes:true,attributeFilter:['class']});});
 mq.addEventListener('change',sync);
 // Only direct section insertions matter; message/content mutations must not retrigger layout.
 let summaryTimer=0;
 const sectionObserver=new MutationObserver(()=>{clearTimeout(summaryTimer);summaryTimer=setTimeout(()=>{syncSummarySections();applySummaryGroups();refreshSummaryMetrics();},0);});
 sectionObserver.observe(right,{childList:true});sectionObserver.observe(panel,{childList:true});
 window.addEventListener('tpf:contact-open',()=>{if(embeddedCreate){window.TPFAgendaComposer?.close({silent:true});restoreComposer();}selected='resumen';delete right.dataset.cpRefProgramsAll;restoreSummaryGroups();sync();select(selected);updateCall();refreshPhoto();});
 modal.addEventListener('input',e=>{if(e.target.id==='contactPhone')updateCall();});
 call.addEventListener('click',updateCall);

 // Summary limits only the number of cards, never the fields inside each card.
 const summaryLists=[['cpOpportunities','oportunidades','.oppUnifiedCard'],['cpTasks','tareas','.cpTaskWrap'],['cpWhatsappPrograms','programados','.cpWaWrap']];
 summaryLists.forEach(([id,key,selector])=>{
  const list=$(id);if(!list)return;
  const more=document.createElement('button');more.type='button';more.className='cpRefMore';more.dataset.cpRefMore=key;
  list.after(more);
  const update=()=>{const count=list.querySelectorAll(':scope > '+selector).length;more.hidden=count<=2;more.textContent=key==='programados'&&right.dataset.cpRefProgramsAll==='true'?'Mostrar solo 2':'Ver todos ('+count+')';};
  more.addEventListener('click',()=>{if(key==='programados'){right.dataset.cpRefProgramsAll=right.dataset.cpRefProgramsAll==='true'?'false':'true';update();}else select(key,true);});
  new MutationObserver(update).observe(list,{childList:true});update();
 });
 const schedule=$('cpScheduleWhatsapp'),oldScheduleText=schedule?.textContent;
 const refreshHeader=()=>{if(schedule)schedule.textContent=mounted?'Programar WhatsApp':oldScheduleText;};
 new MutationObserver(refreshHeader).observe(modal,{attributes:true,attributeFilter:['class']});
 // Reuse the existing read-only avatar loader and its shared in-memory cache.
 let photoKey='',photoEpoch=0;
 const avatar=$('cpAvatar');
 function clearPhotoReady(){
  if(!avatar)return;
  avatar.classList.remove('cpRefPhotoReady');avatar.removeAttribute('role');avatar.removeAttribute('tabindex');avatar.removeAttribute('title');avatar.removeAttribute('aria-label');
 }
 function closePhotoModal(){
  document.querySelector('.tpfContactAvatarModal')?.remove();
  document.removeEventListener('keydown',closePhotoOnKey);
 }
 function closePhotoOnKey(e){if(e.key==='Escape')closePhotoModal();}
 function showPhotoModal(url,name){
  if(!url)return;
  closePhotoModal();
  const viewer=document.createElement('div');viewer.className='tpfAvatarModal tpfContactAvatarModal';viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-label','Foto del contacto ampliada');
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Cerrar foto');
  const image=document.createElement('img');image.src=url;image.alt='Foto de '+String(name||'contacto').trim();image.referrerPolicy='no-referrer';
  viewer.append(close,image);viewer.addEventListener('click',e=>{if(e.target===viewer||e.target===close)closePhotoModal();});
  document.body.appendChild(viewer);document.addEventListener('keydown',closePhotoOnKey);close.focus();
 }
 function openPhotoModal(){
  const source=avatar?.querySelector('.cpRefPhoto');
  if(source?.src)showPhotoModal(source.src,$('contactName')?.value);
 }
 window.TPFContactPhotoViewer={open:showPhotoModal,close:closePhotoModal};
 if(avatar){
  avatar.addEventListener('click',openPhotoModal);
  avatar.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&avatar.querySelector('.cpRefPhoto')){e.preventDefault();openPhotoModal();}});
 }
 function refreshPhoto(){
  if(!avatar)return;
  let contact=null;try{contact=typeof currentContact!=='undefined'?currentContact:null;}catch(_){}
  let phone=String($('contactPhone')?.value||'').replace(/[^0-9]/g,'');
  if(phone.startsWith('00'))phone=phone.slice(2);if(phone.length===9)phone='34'+phone;
  const key=String(contact?.id||'')+':'+phone;
  if(key!==photoKey){photoKey=key;photoEpoch++;closePhotoModal();clearPhotoReady();avatar.querySelector('.cpRefPhoto')?.remove();}
  if(!mounted||modal.classList.contains('hidden')||!contact?.id||!/^[0-9]{10,15}$/.test(phone))return;
  if(typeof waLoadAvatar!=='function'||typeof contactCanUseWhatsapp!=='function'||!contactCanUseWhatsapp())return;
  if(avatar.querySelector('.cpRefPhoto'))return;
  const epoch=++photoEpoch;
  Promise.resolve(waLoadAvatar(phone+'@c.us')).then(url=>{
   if(epoch!==photoEpoch||key!==photoKey||!mounted||modal.classList.contains('hidden')||!url)return;
   if(!/^https:\/\//i.test(url)&&!/^data:image\/(jpeg|png|webp);base64,/i.test(url))return;
   const img=new Image();img.className='cpRefPhoto';img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';
   let expired=false;const timer=setTimeout(()=>{expired=true;img.onload=null;img.onerror=null;},4000);
   img.onload=()=>{clearTimeout(timer);if(!expired&&epoch===photoEpoch&&key===photoKey&&mounted&&!modal.classList.contains('hidden')){avatar.querySelector('.cpRefPhoto')?.remove();avatar.appendChild(img);avatar.classList.add('cpRefPhotoReady');avatar.setAttribute('role','button');avatar.tabIndex=0;avatar.title='Ampliar foto';avatar.setAttribute('aria-label','Ampliar foto del contacto');}};
   img.onerror=()=>{clearTimeout(timer);};img.src=url;
  }).catch(()=>{});
 }
 new MutationObserver(()=>{if(!modal.classList.contains('hidden'))refreshPhoto();}).observe(modal,{attributes:true,attributeFilter:['class']});
 if(avatar)new MutationObserver(()=>{if(!avatar.querySelector('.cpRefPhoto'))refreshPhoto();}).observe(avatar,{childList:true});
 sync();refreshHeader();refreshPhoto();
})();
