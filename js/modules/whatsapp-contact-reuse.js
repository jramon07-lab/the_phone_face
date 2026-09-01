(function(){
'use strict';
const M=window.TPFModules;
if(!M)return;
const $=id=>document.getElementById(id);
const state=window.__tpfWhatsappContactConnectorState||(window.__tpfWhatsappContactConnectorState={taskObserver:null,contactObserver:null,registered:false});

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
  const modal=$('contactModal');
  const detail=$('cpTaskDetailPage');
  modal?.classList.remove('hidden');
  $('cpTaskPage')?.classList.add('hidden');
  $('tpfWaTasksPage')?.classList.add('hidden');
  detail?.classList.remove('hidden');
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
    $('oppDetailModal')?.classList.remove('hidden');
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
  }
}
function taskIdFromRow(row){
  if(!row)return '';
  const direct=row.dataset?.taskId||row.dataset?.agendaId||row.dataset?.id||'';
  if(direct)return direct;
  const nodes=[row,...row.querySelectorAll('[onclick],[data-task-id],[data-agenda-id],[data-id]')];
  for(const el of nodes){
    const id=el.dataset?.taskId||el.dataset?.agendaId||el.dataset?.id||'';
    if(id)return id;
    const code=String(el.getAttribute?.('onclick')||'');
    const m=code.match(/openContactTaskDetail\(['\"]([^'\"]+)['\"]\)/);
    if(m)return m[1];
  }
  return '';
}
async function openTask(id,e){
  stop(e);
  if(!id||!requireContact())return;
  if(typeof window.openContactTaskDetail!=='function')return;
  detachTaskDetail();
  hideFocusedTasks();
  $('cpTaskPage')?.classList.add('hidden');
  $('cpTaskDetailPage')?.classList.add('hidden');

  // The native detail page lives inside contactModal. Keep the parent visible
  // before, during and after the asynchronous database read.
  showContactModal();
  try{
    await window.openContactTaskDetail(id);
  }finally{
    revealTaskDetail();
    requestAnimationFrame(revealTaskDetail);
    setTimeout(revealTaskDetail,0);
  }
}
function patchTaskRows(){
  const box=$('waSideTasks');
  if(!box)return;
  box.querySelectorAll('.waSideItem').forEach(row=>{
    const id=taskIdFromRow(row);
    if(!id)return;
    row.dataset.taskId=id;
    row.removeAttribute('onclick');
    row.onclick=e=>openTask(id,e);
    let edit=row.querySelector('.tpfWaTaskEdit');
    if(!edit){
      edit=document.createElement('button');
      edit.type='button';
      edit.className='tpfWaTaskEdit';
      edit.textContent='Editar';
      row.appendChild(edit);
    }
    edit.onclick=e=>openTask(id,e);
  });
}
function taskRowsFromPanel(){
  return [...($('waSideTasks')?.querySelectorAll('.waSideItem')||[])].map(row=>({
    id:taskIdFromRow(row),
    title:String(row.querySelector('b,strong')?.textContent||'Tarea').trim(),
    detail:String(row.querySelector('small')?.textContent||'').trim()
  })).filter(x=>x.id);
}
function esc(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
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
function viewTasks(e){
  stop(e);
  if(!requireContact())return;
  detachTaskDetail();
  const page=ensureTasksPage();
  if(!page)return;
  const rows=taskRowsFromPanel();
  const list=$('tpfWaTasksList');
  list.innerHTML=rows.length?rows.map(x=>`<div class="cpTaskWrap" data-task-id="${esc(x.id)}"><button class="cpTask cpTaskButton" type="button"><b>${esc(x.title)}</b><span>${esc(x.detail)}</span><small>Pendiente</small></button><div class="cpTaskActions"><button class="tpfWaFocusedTaskEdit" type="button">Editar</button></div></div>`).join(''):'<div class="cpEmpty">No hay tareas pendientes.</div>';
  list.querySelectorAll('[data-task-id]').forEach(row=>{
    const id=row.dataset.taskId;
    row.querySelector('.cpTaskButton').onclick=ev=>openTask(id,ev);
    row.querySelector('.tpfWaFocusedTaskEdit').onclick=ev=>openTask(id,ev);
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
    state.taskObserver=new MutationObserver(()=>patchTaskRows());
    state.taskObserver.observe(tasks,{childList:true,subtree:true});
    state.taskObserverTarget=tasks;
  }
  const card=$('waContactCard');
  if(card&&state.contactObserverTarget!==card){
    state.contactObserver?.disconnect?.();
    state.contactObserver=new MutationObserver(()=>{ensureEditButton();patchTaskRows();});
    state.contactObserver.observe(card,{attributes:true,childList:true,subtree:true,attributeFilter:['class']});
    state.contactObserverTarget=card;
  }
}
function bind(){
  detachTaskDetail();
  bindButton('waSideOpenContact',openProfile);
  bindButton('waSideNewOpp',createOpportunity);
  bindButton('waSideNewTask',createTask);
  bindButton('waSideViewOpps',viewOpportunities);
  bindButton('waSideViewTasks',viewTasks);
  ensureEditButton();
  patchTaskRows();
  observePanels();
}

window.TPFWhatsAppContactConnector={bind,createOpportunity,createTask,openTask,viewTasks,viewOpportunities};
if(!state.registered){
  state.registered=true;
  M.register('whatsapp-contact-reuse',{install(){bind();setTimeout(bind,120);setTimeout(bind,600);}});
}else{
  bind();
}
})();