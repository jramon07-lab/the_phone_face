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
  composer.replaceChildren(...composerChildren);composerChildren=[];composer.removeAttribute('data-contact-dialog');
  taskDialog?.remove();taskDialog=null;modal.inert=contactWasInert;
  composerPositions.splice(0).forEach(({node,parent,next})=>parent.insertBefore(node,next?.parentNode===parent?next:null));
  typeModal?.removeAttribute('data-contact-composer');
  modal.classList.remove('cpRefTaskInside');select(tabBeforeCreate);taskTrigger?.focus();taskTrigger=null;
 }
 const tabs=document.createElement('div');tabs.className='cpRefTabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Información del cliente');
 const panels=[
  ['resumen','Resumen'],['oportunidades','Oportunidades'],['tareas','Tareas'],['documentos','Documentos'],['historial','Historial']
 ];
 panels.forEach(([key,label])=>{
  const b=document.createElement('button');b.type='button';b.id='cpRefTab-'+key;b.dataset.cpRefTab=key;b.textContent=label;b.setAttribute('role','tab');b.setAttribute('aria-controls','cpRefPanel');tabs.appendChild(b);
 });
 const panel=document.createElement('div');panel.id='cpRefPanel';panel.setAttribute('role','tabpanel');panel.tabIndex=0;
 const sections=[...right.children];sections.forEach(section=>{
  section.dataset.cpRefPane=section.contains($('cpOpportunities'))?'oportunidades':section.contains($('cpTasks'))?'tareas':section.contains($('cpWhatsappPrograms'))?'programados':section.id==='cpDocumentsPending'?'documentos':'informacion';
 });
 center.dataset.cpRefPane='historial';
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
   mounted=false;photoEpoch++;avatar?.querySelector('.cpRefPhoto')?.remove();if(heading)heading.textContent=oldHeading;modal.classList.remove('tpfContactReference');
   identityAnchor.after(identity);centerAnchor.after(center);
   sections.forEach(s=>right.appendChild(s));tabs.remove();panel.remove();expiry.remove();edit.remove();call.remove();
  }
 }
 document.addEventListener('click',e=>{
  if(!mounted||modal.classList.contains('hidden')||!composer||typeof window.openAgendaComposer!=='function')return;
  if(!e.target.closest?.('#cpNewTask,#cpSideNewTask'))return;
  e.preventDefault();e.stopImmediatePropagation();if(embeddedCreate)return;
  let contact=null;try{contact=typeof currentContact!=='undefined'?currentContact:null;}catch(_){}
  if(!contact?.id)return;
  const contactId=contact.id;
  tabBeforeCreate=selected;embeddedCreate=true;
  [composer,typeModal].filter(Boolean).forEach(node=>composerPositions.push({node,parent:node.parentNode,next:node.nextSibling}));
  taskTrigger=e.target.closest('#cpNewTask,#cpSideNewTask');
  contactWasInert=modal.inert;modal.inert=true;
  composerChildren=[...composer.childNodes];
  const head=composer.querySelector('.agendaComposerHead'),save=$('agendaSave'),message=$('agendaMsg');
  const formBody=document.createElement('div');formBody.className='cpTaskDialogBody';
  composerChildren.filter(node=>node!==head&&node!==save&&node!==message).forEach(node=>formBody.appendChild(node));
  const footer=document.createElement('div');footer.className='cpTaskDialogFooter';
  const back=document.createElement('button');back.type='button';back.textContent='← Volver';back.addEventListener('click',()=>window.TPFAgendaComposer?.close());
  footer.append(save,back,message);composer.replaceChildren(head,formBody,footer);
  taskDialog=document.createElement('div');taskDialog.className='cpTaskDialogBackdrop';taskDialog.setAttribute('role','dialog');taskDialog.setAttribute('aria-modal','true');taskDialog.setAttribute('aria-label','Nueva tarea');
  composer.setAttribute('data-contact-dialog','true');taskDialog.appendChild(composer);document.body.appendChild(taskDialog);
  taskDialog.addEventListener('keydown',event=>{
   if(event.key!=='Tab')return;
   const controls=[...taskDialog.querySelectorAll('button,input,select,textarea,a[href]')].filter(node=>!node.disabled&&node.getClientRects().length);
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  if(typeModal){document.body.appendChild(typeModal);typeModal.setAttribute('data-contact-composer','true');}
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
 window.addEventListener('tpf:contact-open',()=>{if(embeddedCreate){window.TPFAgendaComposer?.close({silent:true});restoreComposer();}selected='resumen';delete right.dataset.cpRefProgramsAll;sync();select(selected);updateCall();refreshPhoto();});
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
 function refreshPhoto(){
  if(!avatar)return;
  let contact=null;try{contact=typeof currentContact!=='undefined'?currentContact:null;}catch(_){}
  let phone=String($('contactPhone')?.value||'').replace(/[^0-9]/g,'');
  if(phone.startsWith('00'))phone=phone.slice(2);if(phone.length===9)phone='34'+phone;
  const key=String(contact?.id||'')+':'+phone;
  if(key!==photoKey){photoKey=key;photoEpoch++;avatar.querySelector('.cpRefPhoto')?.remove();}
  if(!mounted||modal.classList.contains('hidden')||!contact?.id||!/^[0-9]{10,15}$/.test(phone))return;
  if(typeof waLoadAvatar!=='function'||typeof contactCanUseWhatsapp!=='function'||!contactCanUseWhatsapp())return;
  if(avatar.querySelector('.cpRefPhoto'))return;
  const epoch=++photoEpoch;
  Promise.resolve(waLoadAvatar(phone+'@c.us')).then(url=>{
   if(epoch!==photoEpoch||key!==photoKey||!mounted||modal.classList.contains('hidden')||!url)return;
   if(!/^https:\/\//i.test(url)&&!/^data:image\/(jpeg|png|webp);base64,/i.test(url))return;
   const img=new Image();img.className='cpRefPhoto';img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';
   let expired=false;const timer=setTimeout(()=>{expired=true;img.onload=null;img.onerror=null;},4000);
   img.onload=()=>{clearTimeout(timer);if(!expired&&epoch===photoEpoch&&key===photoKey&&mounted&&!modal.classList.contains('hidden')){avatar.querySelector('.cpRefPhoto')?.remove();avatar.appendChild(img);}};
   img.onerror=()=>{clearTimeout(timer);};img.src=url;
  }).catch(()=>{});
 }
 new MutationObserver(()=>{if(!modal.classList.contains('hidden'))refreshPhoto();}).observe(modal,{attributes:true,attributeFilter:['class']});
 if(avatar)new MutationObserver(()=>{if(!avatar.querySelector('.cpRefPhoto'))refreshPhoto();}).observe(avatar,{childList:true});
 sync();refreshHeader();refreshPhoto();
})();
