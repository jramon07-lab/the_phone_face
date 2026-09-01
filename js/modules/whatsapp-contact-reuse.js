(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
let taskObserver=null,taskObserverBox=null,taskPatchQueued=false;
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
 if(typeof openContactNewOpportunity==='function')return openContactNewOpportunity();
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
function taskRowFromNode(node){
 const box=$('waSideTasks');if(!box||!node)return node||null;
 let row=node.nodeType===1?node:null;
 while(row&&row.parentElement&&row.parentElement!==box)row=row.parentElement;
 return row&&row.parentElement===box?row:(node.closest?.('[data-task-id],[data-agenda-id],[data-id],.waSideItem,.cpTaskWrap')||node);
}
function taskIdFromNode(node){
 const row=taskRowFromNode(node);
 const nodes=[];
 for(const el of [node,row,...(row?.querySelectorAll?.('[onclick],[data-task-id],[data-agenda-id],[data-id]')||[])]){
   if(el&&!nodes.includes(el))nodes.push(el);
 }
 for(const el of nodes){
   if(!el)continue;
   const data=el.dataset||{};
   const direct=data.taskId||data.agendaId||data.id||data.task||data.agenda||'';
   if(direct)return String(direct);
   for(const [key,value] of Object.entries(data)){
     if(/task|agenda|(^|_)id$/i.test(key)&&value)return String(value);
   }
   const oc=String(el.getAttribute?.('onclick')||'');
   const fn=oc.match(/(?:openContactTaskDetail|openAgendaItem|editAgendaItem|waOpenTask|waEditTaskFromSide)\s*\(\s*['\"]?([^'\"),\s]+)[^)]*\)/i);
   if(fn)return fn[1];
   const uuid=oc.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
   if(uuid)return uuid[0];
 }
 return '';
}
async function resolveTaskId(node){
 const direct=taskIdFromNode(node);if(direct)return direct;
 const c=contact(),row=taskRowFromNode(node);if(!c||!row)return '';
 const d=c.data||{};
 const phone=String(d['TELÉFONO']||d.TELEFONO||d.PHONE||d.MOVIL||'').replace(/\D/g,'').slice(-9);
 const name=String(d['NOMBRE Y APELLIDOS']||d.NOMBRE||'').trim().toLowerCase();
 const title=String(row.querySelector?.('b,strong,h3,h4')?.textContent||'').trim().toLowerCase();
 try{
   const {data,error}=await sb.from('agenda_items').select('id,title,customer_phone,customer_name,related_record_id,status,starts_at').order('starts_at',{ascending:true}).limit(150);
   if(error)throw error;
   const rows=(data||[]).filter(x=>{
     if(x.whatsapp_enabled||String(x.title||'').trim().toLowerCase()==='whatsapp programado')return false;
     const xp=String(x.customer_phone||'').replace(/\D/g,'').slice(-9);
     const xn=String(x.customer_name||'').trim().toLowerCase();
     return String(x.related_record_id||'')===String(c.id)||(phone&&xp===phone)||(name&&xn===name);
   });
   if(title){const exact=rows.find(x=>String(x.title||'').trim().toLowerCase()===title);if(exact)return String(exact.id)}
   return rows[0]?.id?String(rows[0].id):'';
 }catch(_){return ''}
}
async function openTaskId(id){
 if(!id)return;
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 fixTaskDetailDom();closeFocusedTasks();
 $('contactModal')?.classList.remove('hidden');
 $('cpTaskPage')?.classList.add('hidden');
 $('cpTaskDetailPage')?.classList.add('hidden');
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
function taskRows(){
 const box=$('waSideTasks');if(!box)return [];
 const direct=[...box.children].filter(row=>row.nodeType===1&&!row.matches('.small,.cpEmpty'));
 const marked=[...box.querySelectorAll('.waSideItem,[data-task-id],[data-agenda-id],.cpTaskWrap')];
 return [...new Set([...marked,...direct])].filter(row=>!marked.some(other=>other!==row&&row.contains(other)));
}
function wireTaskRow(row,id){
 if(!row||!id)return;
 row.dataset.taskId=id;row.removeAttribute('onclick');
 row.onclick=e=>{
   const action=e.target.closest?.('button,a');const txt=String(action?.textContent||'').trim().toLowerCase();
   if(action&&/eliminar|borrar/.test(txt))return;
   e.preventDefault();e.stopPropagation();openTaskId(id);
 };
 let edit=[...row.querySelectorAll('button,a')].find(x=>/^(editar|ver\s*\/\s*editar)$/i.test(String(x.textContent||'').trim()));
 if(!edit){edit=document.createElement('button');edit.type='button';edit.textContent='Editar';row.appendChild(edit)}
 edit.classList.add('tpfWaTaskEdit');edit.dataset.taskId=id;
 edit.onclick=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openTaskId(id)};
}
async function patchTaskCards(){
 for(const row of taskRows()){
   const id=await resolveTaskId(row);if(id)wireTaskRow(row,id);
 }
}
function scheduleTaskPatch(){
 if(taskPatchQueued)return;taskPatchQueued=true;
 requestAnimationFrame(()=>{taskPatchQueued=false;patchTaskCards().catch(()=>{})});
}
function ensureTaskObserver(){
 const box=$('waSideTasks');if(!box||taskObserverBox===box)return;
 taskObserver?.disconnect?.();taskObserverBox=box;
 taskObserver=new MutationObserver(()=>scheduleTaskPatch());
 taskObserver.observe(box,{childList:true,subtree:true});
 scheduleTaskPatch();
}
function ensureEditButton(){
 const open=$('waSideOpenContact');if(!open)return;let edit=$('waSideEditContact');
 if(!edit){edit=document.createElement('button');edit.id='waSideEditContact';edit.type='button';edit.className='secondary full hidden';edit.textContent='Editar datos';open.insertAdjacentElement('afterend',edit)}
 const found=!!contact();edit.classList.toggle('hidden',!found);edit.style.display=found?'block':'none';edit.onclick=e=>{e.preventDefault();e.stopPropagation();openEdit()};
}
function bind(){
 fixTaskDetailDom();
 cleanButton('waSideOpenContact',openProfile);cleanButton('waSideNewOpp',createOpp);cleanButton('waSideNewTask',createTask);cleanButton('waSideViewOpps',viewOpps);cleanButton('waSideViewTasks',viewTasks);
 ensureEditButton();ensureTaskObserver();scheduleTaskPatch();
 const opps=$('waSideOpps');if(opps&&opps.dataset.tpfDirect!=='1'){opps.dataset.tpfDirect='1';opps.addEventListener('click',e=>{if(e.target.closest('select,input'))return;const card=e.target.closest('[data-opp-id]');const id=card?.dataset.oppId;if(!id)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(typeof window.openOpportunityFull==='function')window.openOpportunityFull(id);else window.openOpportunityCard?.(id)},true)}
}
async function capture(e){
 const t=e.target;
 if(t?.closest?.('#waSideNewOpp')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();createOpp();return}
 if(t?.closest?.('#waSideNewTask')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();createTask();return}
 if(t?.closest?.('#waSideViewOpps')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();viewOpps();return}
 if(t?.closest?.('#waSideViewTasks')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();viewTasks();return}
 if(t?.closest?.('#waSideTasks')){
   const action=t.closest?.('button,a'),txt=String(action?.textContent||'').trim().toLowerCase();
   if(action&&/eliminar|borrar/.test(txt))return;
   if(action&&!/editar|ver/.test(txt))return;
   const row=taskRowFromNode(t),id=await resolveTaskId(t);
   if(row&&id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openTaskId(id)}
 }
}
M.register('whatsapp-contact-reuse',{install(){bind();document.addEventListener('click',capture,true);document.addEventListener('click',e=>{if(e.target.closest?.('.waChatRow,#waSideCreateContact'))setTimeout(bind,120)},true);setInterval(bind,1200)}});
})();
