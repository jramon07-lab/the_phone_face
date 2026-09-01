(function(){
'use strict';
const M=window.TPFModules;
if(!M)return;
const $=id=>document.getElementById(id);
const state=window.__tpfWhatsappContactConnectorState||(window.__tpfWhatsappContactConnectorState={
  taskObserver:null,
  contactObserver:null,
  taskObserverTarget:null,
  contactObserverTarget:null,
  taskSyncTimer:null,
  taskSyncBusy:false,
  taskSyncAgain:false,
  captureBound:false,
  registered:false
});

function stop(e){
  e?.preventDefault?.();
  e?.stopPropagation?.();
  e?.stopImmediatePropagation?.();
}
function contact(){
  try{return waLiveState?.contact||null}catch(_){return null}
}
function prepare(){
  try{return typeof waPrepareCurrentContactForCrm==='function'&&waPrepareCurrentContactForCrm()}catch(_){return false}
}
function requireContact(){
  if(prepare())return true;
  alert('Primero vincula este chat con un contacto.');
  return false;
}
function detachTaskDetail(){
  const page=$('cpTaskPage'),detail=$('cpTaskDetailPage');
  if(page&&detail&&page.contains(detail)&&page.parentElement){
    page.parentElement.insertBefore(detail,page.nextSibling);
  }
}
function hideFocusedTasks(){
  $('tpfWaTasksPage')?.classList.add('hidden');
}
function hideContactModal(){
  $('contactModal')?.classList.add('hidden');
}
function showContactModal(){
  $('contactModal')?.classList.remove('hidden');
}
function revealTaskDetail(){
  detachTaskDetail();
  $('cpTaskPage')?.classList.add('hidden');
  showContactModal();
  $('cpTaskDetailPage')?.classList.remove('hidden');
}
function esc(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function digits(value){
  return String(value||'').replace(/\D/g,'').slice(-9);
}
function norm(value){
  return String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
}
function taskTitle(row){
  return String(row?.querySelector?.('.waTaskTitle,b,strong,h3,h4')?.textContent||'').trim();
}
function taskRows(){
  const box=$('waSideTasks');
  if(!box)return [];
  const explicit=[...box.querySelectorAll('.waTaskCard,.waSideItem,[data-task-id],[data-agenda-id]')];
  const direct=[...box.children].filter(row=>{
    if(row.nodeType!==1||row.matches('.small,.cpEmpty'))return false;
    return [...row.querySelectorAll('button,a')].some(el=>/^(editar|ver\s*\/\s*editar)$/i.test(String(el.textContent||'').trim()));
  });
  return [...new Set([...explicit,...direct])].filter(row=>
    !explicit.some(other=>other!==row&&row.contains(other))
  );
}

async function relatedTasks(){
  const c=contact();
  if(!c||typeof sb==='undefined')return [];
  const d=c.data||{};
  const phone=digits(d['TELÉFONO']||d.TELEFONO||d.PHONE||d.MOVIL||'');
  const name=norm(d['NOMBRE Y APELLIDOS']||[d.NOMBRE,d.APELLIDOS].filter(Boolean).join(' ')||d.NOMBRE||'');
  try{
    const {data,error}=await sb.from('agenda_items').select('*').order('starts_at',{ascending:true}).limit(200);
    if(error)throw error;
    return (data||[]).filter(item=>{
      if(item.whatsapp_enabled||norm(item.title)==='whatsapp programado')return false;
      const itemPhone=digits(item.customer_phone||item.phone||'');
      const itemName=norm(item.customer_name||item.client_name||'');
      return String(item.related_record_id||'')===String(c.id)||(phone&&itemPhone===phone)||(name&&itemName===name);
    });
  }catch(err){
    console.warn('WhatsApp tareas del contacto',err);
    return [];
  }
}
function findTaskForRow(row,tasks,used){
  const direct=String(row?.dataset?.taskId||row?.dataset?.agendaId||row?.dataset?.id||'');
  if(direct){
    const exact=tasks.find(x=>String(x.id)===direct);
    if(exact)return exact;
  }
  const title=norm(taskTitle(row));
  const rowText=norm(row?.textContent||'');
  let candidates=tasks.filter(x=>!used.has(String(x.id))&&norm(x.title||x.subject||'')===title);
  if(candidates.length>1){
    const dated=candidates.find(x=>{
      if(!x.starts_at)return false;
      const full=norm(new Date(x.starts_at).toLocaleString('es-ES'));
      const date=norm(new Date(x.starts_at).toLocaleDateString('es-ES'));
      return rowText.includes(full)||rowText.includes(date);
    });
    if(dated)return dated;
  }
  if(candidates[0])return candidates[0];
  return tasks.find(x=>!used.has(String(x.id))&&rowText.includes(norm(x.title||x.subject||'')))||null;
}
function wireTaskRow(row,id){
  if(!row||!id)return;
  row.dataset.taskId=String(id);
  row.removeAttribute('onclick');
  const editButtons=[...row.querySelectorAll('button,a')].filter(el=>
    /^(editar|ver\s*\/\s*editar)$/i.test(String(el.textContent||'').trim())
  );
  editButtons.forEach(edit=>{
    edit.dataset.taskId=String(id);
    edit.removeAttribute('onclick');
    edit.onclick=e=>openTask(id,e);
  });
  row.onclick=e=>{
    const action=e.target.closest?.('button,a,input,select,textarea,label');
    if(action)return;
    openTask(id,e);
  };
}
async function syncTaskRowsNow(){
  if(state.taskSyncBusy){state.taskSyncAgain=true;return}
  state.taskSyncBusy=true;
  try{
    const rows=taskRows();
    if(!rows.length)return;
    const tasks=await relatedTasks();
    const used=new Set();
    rows.forEach(row=>{
      const task=findTaskForRow(row,tasks,used);
      if(!task)return;
      used.add(String(task.id));
      wireTaskRow(row,task.id);
    });
  }finally{
    state.taskSyncBusy=false;
    if(state.taskSyncAgain){state.taskSyncAgain=false;scheduleTaskSync(20)}
  }
}
function scheduleTaskSync(delay=80){
  clearTimeout(state.taskSyncTimer);
  state.taskSyncTimer=setTimeout(syncTaskRowsNow,delay);
}
async function resolveTaskId(row){
  const direct=String(row?.dataset?.taskId||row?.dataset?.agendaId||row?.dataset?.id||'');
  if(direct)return direct;
  const tasks=await relatedTasks();
  const found=findTaskForRow(row,tasks,new Set());
  if(found){wireTaskRow(row,found.id);return String(found.id)}
  return '';
}

async function openProfile(e){
  stop(e);
  const c=contact();
  if(!c)return alert('Primero vincula este chat con un contacto.');
  hideFocusedTasks();
  if(typeof window.openContact==='function')await window.openContact(c.id);
}
async function openEdit(e){
  stop(e);
  const c=contact();
  if(!c)return alert('Primero vincula este chat con un contacto.');
  hideFocusedTasks();
  if(typeof window.openContact!=='function')return;
  await window.openContact(c.id);
  $('tpfContactEditToggle')?.click();
}
async function createOpportunity(e){
  stop(e);
  if(!requireContact())return;
  try{
    if(!(salesCache?.stages||[]).length&&typeof loadSales==='function')await loadSales();
  }catch(_){}
  hideFocusedTasks();
  hideContactModal();
  $('cpTaskPage')?.classList.add('hidden');
  $('cpTaskDetailPage')?.classList.add('hidden');
  if(typeof openContactNewOpportunity==='function'){
    openContactNewOpportunity();
    const reveal=()=>{
      hideContactModal();
      $('oppDetailModal')?.classList.remove('hidden');
    };
    reveal();
    requestAnimationFrame(reveal);
  }
}
function createTask(e){
  stop(e);
  if(!requireContact())return;
  detachTaskDetail();
  hideFocusedTasks();
  hideContactModal();
  $('cpTaskDetailPage')?.classList.add('hidden');
  if(typeof openContactTaskPage==='function'){
    openContactTaskPage();
    showContactModal();
    $('cpTaskPage')?.classList.remove('hidden');
  }
}
async function openTask(id,e){
  stop(e);
  if(!id||!requireContact())return;
  detachTaskDetail();
  hideFocusedTasks();
  hideContactModal();
  $('cpTaskPage')?.classList.add('hidden');
  $('cpTaskDetailPage')?.classList.add('hidden');
  if(typeof window.openContactTaskDetail==='function'){
    await window.openContactTaskDetail(String(id));
    revealTaskDetail();
    requestAnimationFrame(revealTaskDetail);
    setTimeout(revealTaskDetail,40);
    setTimeout(revealTaskDetail,140);
  }
}

function ensureTasksPage(){
  let page=$('tpfWaTasksPage');
  if(page)return page;
  const host=$('contactModal')?.querySelector('.contactProfile');
  if(!host)return null;
  page=document.createElement('div');
  page.id='tpfWaTasksPage';
  page.className='cpTaskPage hidden';
  page.innerHTML='<div class="cpTaskPageTop"><button id="tpfWaTasksBack" class="cpExit" type="button">← Volver</button><div><b>Tareas del contacto</b><small>Consulta y edita sus tareas</small></div><button id="tpfWaTasksNew" class="primary" type="button">+ Nueva tarea</button></div><div class="cpTaskPageBody"><div class="cpTaskFormCard" style="max-width:none"><h2>Tareas</h2><div id="tpfWaTasksList"></div></div></div>';
  host.appendChild(page);
  $('tpfWaTasksBack').onclick=e=>{stop(e);page.classList.add('hidden');hideContactModal();};
  $('tpfWaTasksNew').onclick=createTask;
  return page;
}
async function viewTasks(e){
  stop(e);
  if(!requireContact())return;
  detachTaskDetail();
  const page=ensureTasksPage();
  if(!page)return;
  const tasks=await relatedTasks();
  const list=$('tpfWaTasksList');
  list.innerHTML=tasks.length?tasks.map(task=>`<div class="cpTaskWrap" data-task-id="${esc(task.id)}"><button class="cpTask cpTaskButton" type="button"><b>${esc(task.title||task.subject||'Tarea')}</b><span>${task.starts_at?esc(new Date(task.starts_at).toLocaleString('es-ES')):''}</span><small>${task.status==='completed'?'Completada':'Pendiente'}</small></button><div class="cpTaskActions"><button class="tpfWaFocusedTaskEdit" type="button">Editar</button></div></div>`).join(''):'<div class="cpEmpty">No hay tareas.</div>';
  list.querySelectorAll('[data-task-id]').forEach(row=>{
    const id=row.dataset.taskId;
    row.querySelector('.cpTaskButton').onclick=event=>openTask(id,event);
    row.querySelector('.tpfWaFocusedTaskEdit').onclick=event=>openTask(id,event);
  });
  $('cpTaskPage')?.classList.add('hidden');
  $('cpTaskDetailPage')?.classList.add('hidden');
  showContactModal();
  page.classList.remove('hidden');
}
function viewOpportunities(e){
  stop(e);
  if(!requireContact())return;
  const first=$('waSideOpps')?.querySelector('[data-opp-id]');
  const id=first?.dataset?.oppId||'';
  if(!id)return alert('Este contacto no tiene oportunidades.');
  hideContactModal();
  if(typeof window.openOpportunityFull==='function')return window.openOpportunityFull(id);
  if(typeof window.openOpportunityCard==='function')return window.openOpportunityCard(id);
}
function bindButton(id,handler){
  const button=$(id);
  if(!button)return;
  button.removeAttribute('onclick');
  button.onclick=handler;
  button.dataset.tpfNativeContactAction='1';
}
function ensureEditButton(){
  const open=$('waSideOpenContact');
  if(!open)return;
  let edit=$('waSideEditContact');
  if(!edit){
    edit=document.createElement('button');
    edit.id='waSideEditContact';
    edit.type='button';
    edit.className='secondary full hidden';
    edit.textContent='Editar datos';
    open.insertAdjacentElement('afterend',edit);
  }
  const found=!!contact();
  edit.classList.toggle('hidden',!found);
  edit.style.display=found?'block':'none';
  edit.onclick=openEdit;
}
function observePanels(){
  const tasks=$('waSideTasks');
  if(tasks&&state.taskObserverTarget!==tasks){
    state.taskObserver?.disconnect?.();
    state.taskObserver=new MutationObserver(()=>scheduleTaskSync());
    state.taskObserver.observe(tasks,{childList:true,subtree:true});
    state.taskObserverTarget=tasks;
  }
  const card=$('waContactCard');
  if(card&&state.contactObserverTarget!==card){
    state.contactObserver?.disconnect?.();
    state.contactObserver=new MutationObserver(()=>{ensureEditButton();scheduleTaskSync();});
    state.contactObserver.observe(card,{attributes:true,childList:true,subtree:true,attributeFilter:['class']});
    state.contactObserverTarget=card;
  }
}
async function capture(e){
  const target=e.target;
  if(!target?.closest)return;
  if(target.closest('#waSideOpenContact'))return openProfile(e);
  if(target.closest('#waSideEditContact'))return openEdit(e);
  if(target.closest('#waSideNewOpp'))return createOpportunity(e);
  if(target.closest('#waSideNewTask'))return createTask(e);
  if(target.closest('#waSideViewOpps'))return viewOpportunities(e);
  if(target.closest('#waSideViewTasks'))return viewTasks(e);
  if(!target.closest('#waSideTasks'))return;
  const row=target.closest('.waTaskCard,.waSideItem,[data-task-id],[data-agenda-id]');
  if(!row)return;
  const action=target.closest('button,a');
  const text=String(action?.textContent||'').trim();
  if(action&&/completar|eliminar|borrar/i.test(text))return;
  if(action&&!/^(editar|ver\s*\/\s*editar)$/i.test(text))return;
  stop(e);
  const id=await resolveTaskId(row);
  if(id)await openTask(id);
}
function bindCapture(){
  if(state.captureBound)return;
  state.captureBound=true;
  window.addEventListener('click',capture,true);
}
function bind(){
  detachTaskDetail();
  bindButton('waSideOpenContact',openProfile);
  bindButton('waSideNewOpp',createOpportunity);
  bindButton('waSideNewTask',createTask);
  bindButton('waSideViewOpps',viewOpportunities);
  bindButton('waSideViewTasks',viewTasks);
  ensureEditButton();
  observePanels();
  bindCapture();
  scheduleTaskSync(20);
}

window.TPFWhatsAppContactConnector={bind,createOpportunity,createTask,openTask,viewTasks,viewOpportunities,syncTaskRows:syncTaskRowsNow};
if(!state.registered){
  state.registered=true;
  M.register('whatsapp-contact-reuse',{install(){bind();setTimeout(bind,120);setTimeout(bind,600);}});
}else{
  bind();
}
})();
