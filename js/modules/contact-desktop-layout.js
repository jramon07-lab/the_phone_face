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
 let mounted=false,selected='documentos';
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
  return ['tpfTaskStandalone','tpfListTaskModal','tpf-wa-task-mode','tpf-wa-task-flow'].some(c=>modal.classList.contains(c)) ||
   ['cpTaskPage','cpTaskDetailPage','tpfWaTasksPage'].some(id=>{const e=$(id);return e&&!e.classList.contains('hidden');});
 }
 function sync(){
  const on=mq.matches&&!taskMode();
  if(on&&!mounted){
   mounted=true;if(heading)heading.textContent='Ficha del cliente';
   columns.before(identity);
   sections.forEach(s=>panel.appendChild(s));panel.appendChild(center);right.append(tabs,panel);
   left.appendChild(expiry);identity.querySelector('.cpQuick')?.prepend(call);
   modal.querySelector('.cpTop')?.appendChild(edit);
   modal.classList.add('tpfContactReference');select(selected);updateCall();
  }else if(!on&&mounted){
   mounted=false;if(heading)heading.textContent=oldHeading;modal.classList.remove('tpfContactReference');
   identityAnchor.after(identity);centerAnchor.after(center);
   sections.forEach(s=>right.appendChild(s));tabs.remove();panel.remove();expiry.remove();edit.remove();call.remove();
  }
 }
 const observer=new MutationObserver(sync);observer.observe(modal,{attributes:true,attributeFilter:['class']});
 ['cpTaskPage','cpTaskDetailPage'].forEach(id=>{if($(id))observer.observe($(id),{attributes:true,attributeFilter:['class']});});
 mq.addEventListener('change',sync);
 window.addEventListener('tpf:contact-open',()=>{selected='documentos';sync();select(selected);updateCall();});
 modal.addEventListener('input',e=>{if(e.target.id==='contactPhone')updateCall();});
 call.addEventListener('click',updateCall);
 sync();
})();
