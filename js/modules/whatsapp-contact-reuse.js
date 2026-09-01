(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
function contact(){try{return waLiveState?.contact||null}catch(_){return null}}
function prepare(){try{return typeof waPrepareCurrentContactForCrm==='function'&&waPrepareCurrentContactForCrm()}catch(_){return false}}
function fixTaskDetailDom(){
 const page=$('cpTaskPage'),detail=$('cpTaskDetailPage');
 if(page&&detail&&page.contains(detail)&&page.parentElement){page.parentElement.insertBefore(detail,page.nextSibling)}
}
function closeFocusedTasks(){const p=$('tpfWaTasksPage');if(p)p.classList.add('hidden')}
async function openProfile(){const c=contact();if(!c)return alert('Primero vincula este chat con un contacto.');closeFocusedTasks();if(typeof window.openContact==='function')return window.openContact(c.id)}
async function openEdit(){const c=contact();if(!c)return alert('Primero vincula este chat con un contacto.');await openProfile();setTimeout(()=>$('tpfContactEditToggle')?.click(),60)}
async function createOpp(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 try{if(!(salesCache?.stages||[]).length&&typeof loadSales==='function')await loadSales()}catch(_){}
 $('contactModal')?.classList.add('hidden');
 $('cpTaskPage')?.classList.add('hidden');
 $('cpTaskDetailPage')?.classList.add('hidden');
 closeFocusedTasks();
 if(typeof openContactNewOpportunity==='function'){openContactNewOpportunity();$('oppDetailModal')?.classList.remove('hidden');return}
 if(typeof window.waCreateOpportunityFromSide==='function')return window.waCreateOpportunityFromSide();
}
function createTask(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 fixTaskDetailDom();closeFocusedTasks();
 $('contactModal')?.classList.remove('hidden');
 $('cpTaskDetailPage')?.classList.add('hidden');
 if(typeof openContactTaskPage==='function')return openContactTaskPage();
 if(typeof window.waCreateTaskFromSide==='function')return window.waCreateTaskFromSide();
}
function taskIdFromNode(node){
 const row=node?.closest?.('[data-task-id],[data-agenda-id],[data-id],.waSideItem,.cpTaskWrap')||node;
 for(const el of [node,row,...(row?.querySelectorAll?.('[onclick],[data-task-id],[data-agenda-id],[data-id]')||[])]){
   if(!el)continue;
   const d=el.dataset?.taskId||el.dataset?.agendaId||el.dataset?.id||'';if(d)return d;
   const oc=String(el.getAttribute?.('onclick')||'');
   const m=oc.match(/openContactTaskDetail\(['\"]([^'\"]+)['\"]\)/);if(m)return m[1];
 }
 return '';
}
async function openTaskId(id){
 if(!id)return;
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 fixTaskDetailDom();closeFocusedTasks();
 $('contactModal')?.classList.remove('hidden');
 $('cpTaskPage')?.classList.add('hidden');
 if(typeof window.openContactTaskDetail==='function')return window.openContactTaskDetail(id);
}
async function contactTasks(){
 const c=contact();if(!c)return [];
 const d=c.data||{};
 const phone=String(d['TELÉFONO']||d.TELEFONO||d.PHONE||'').replace(/\D/g,'').slice(-9);
 const name=String(d['NOMBRE Y APELLIDOS']||d.NOMBRE||'').trim().toLowerCase();
 try{
   const {data,error}=await sb.from('agenda_items').select('*').order('starts_at',{ascending:false}).limit(150);if(error)throw error;
   return (data||[]).filter(x=>{
     if(x.whatsapp_enabled||String(x.title||'').trim().toLowerCase()==='whatsapp programado')return false;
     const xp=String(x.customer_phone||x.phone||'').replace(/\D/g,'').slice(-9);
     const xn=String(x.customer_name||x.client_name||'').trim().toLowerCase();
     return String(x.related_record_id||'')===String(c.id)||(phone&&xp===phone)||(name&&xn===name);
   });
 }catch(_){return []}
}
function ensureFocusedTasksPage(){
 let p=$('tpfWaTasksPage');if(p)return p;
 const host=$('contactModal')?.querySelector('.contactProfile');if(!host)return null;
 p=document.createElement('div');p.id='tpfWaTasksPage';p.className='cpTaskPage hidden';
 p.innerHTML='<div class="cpTaskPageTop"><button id="tpfWaTasksBack" class="cpExit">← Volver</button><div><b>Tareas del contacto</b><small>Consulta y edita sus tareas directamente</small></div><button id="tpfWaTasksNew" class="primary">+ Nueva tarea</button></div><div class="cpTaskPageBody"><div class="cpTaskFormCard" style="max-width:none"><h2>Tareas</h2><div id="tpfWaTasksList"></div></div></div>';
 host.appendChild(p);
 $('tpfWaTasksBack').onclick=()=>{p.classList.add('hidden');$('contactModal')?.classList.add('hidden')};
 $('tpfWaTasksNew').onclick=createTask;
 return p;
}
async function viewTasks(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 fixTaskDetailDom();
 const p=ensureFocusedTasksPage();if(!p)return;
 const rows=await contactTasks();
 const list=$('tpfWaTasksList');
 list.innerHTML=rows.length?rows.map(t=>`<div class="cpTaskWrap" data-task-id="${String(t.id)}"><button class="cpTask cpTaskButton" type="button"><b>${String(t.title||t.subject||'Tarea').replace(/[&<>]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]))}</b><span>${t.starts_at?new Date(t.starts_at).toLocaleString('es-ES'):''}</span><small>${t.status==='completed'?'Completada':'Pendiente'}</small></button><div class="cpTaskActions"><button type="button" data-edit-task="${String(t.id)}">Editar</button></div></div>`).join(''):'<div class="cpEmpty">No hay tareas.</div>';
 list.querySelectorAll('[data-task-id]').forEach(row=>row.querySelector('.cpTaskButton')?.addEventListener('click',()=>openTaskId(row.dataset.taskId)));
 list.querySelectorAll('[data-edit-task]').forEach(b=>b.addEventListener('click',()=>openTaskId(b.dataset.editTask)));
 $('contactModal')?.classList.remove('hidden');$('cpTaskPage')?.classList.add('hidden');$('cpTaskDetailPage')?.classList.add('hidden');
 p.classList.remove('hidden');
}
async function viewOpps(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 const first=$('waSideOpps')?.querySelector('[data-opp-id]');const id=first?.dataset.oppId;
 if(id&&typeof window.openOpportunityFull==='function')return window.openOpportunityFull(id);
 if(id&&typeof window.openOpportunityCard==='function')return window.openOpportunityCard(id);
 await openProfile();setTimeout(()=>document.querySelector('#contactModal .cpTabs span:nth-child(3)')?.click(),30);
}
function cleanButton(id,handler){
 const old=$(id);if(!old)return;
 if(old.dataset.tpfDirect==='1'){old.onclick=handler;return}
 const b=old.cloneNode(true);b.dataset.tpfDirect='1';b.removeAttribute('onclick');b.onclick=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();handler()};old.replaceWith(b);
}
function patchTaskCards(){
 const box=$('waSideTasks');if(!box)return;
 box.querySelectorAll('.waSideItem').forEach(row=>{
   const id=taskIdFromNode(row);if(!id)return;
   row.dataset.taskId=id;row.removeAttribute('onclick');row.onclick=e=>{e.preventDefault();e.stopPropagation();openTaskId(id)};
   let edit=row.querySelector('.tpfWaTaskEdit');if(!edit){edit=document.createElement('button');edit.type='button';edit.className='tpfWaTaskEdit';edit.textContent='Editar';row.appendChild(edit)}
   edit.onclick=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openTaskId(id)};
 });
}
function ensureEditButton(){
 const open=$('waSideOpenContact');if(!open)return;let edit=$('waSideEditContact');
 if(!edit){edit=document.createElement('button');edit.id='waSideEditContact';edit.type='button';edit.className='secondary full hidden';edit.textContent='Editar datos';open.insertAdjacentElement('afterend',edit)}
 const found=!!contact();edit.classList.toggle('hidden',!found);edit.style.display=found?'block':'none';edit.onclick=e=>{e.preventDefault();e.stopPropagation();openEdit()};
}
function bind(){
 fixTaskDetailDom();
 cleanButton('waSideOpenContact',openProfile);cleanButton('waSideNewOpp',createOpp);cleanButton('waSideNewTask',createTask);cleanButton('waSideViewOpps',viewOpps);cleanButton('waSideViewTasks',viewTasks);
 ensureEditButton();patchTaskCards();
 const opps=$('waSideOpps');if(opps&&opps.dataset.tpfDirect!=='1'){opps.dataset.tpfDirect='1';opps.addEventListener('click',e=>{if(e.target.closest('select,input'))return;const card=e.target.closest('[data-opp-id]');const id=card?.dataset.oppId;if(!id)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(typeof window.openOpportunityFull==='function')window.openOpportunityFull(id);else window.openOpportunityCard?.(id)},true)}
}
function capture(e){
 const t=e.target;
 if(t?.closest?.('#waSideNewOpp')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();createOpp();return}
 if(t?.closest?.('#waSideNewTask')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();createTask();return}
 if(t?.closest?.('#waSideViewOpps')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();viewOpps();return}
 if(t?.closest?.('#waSideViewTasks')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();viewTasks();return}
 if(t?.closest?.('#waSideTasks')){const row=t.closest('.waSideItem,[data-task-id]');if(row){const id=taskIdFromNode(t)||row.dataset.taskId;if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openTaskId(id)}}}
}
M.register('whatsapp-contact-reuse',{install(){bind();document.addEventListener('click',capture,true);document.addEventListener('click',e=>{if(e.target.closest?.('.waChatRow,#waSideCreateContact'))setTimeout(bind,120)},true);setInterval(bind,700)}});
})();
