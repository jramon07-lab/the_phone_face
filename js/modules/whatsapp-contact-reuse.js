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
  registered:false,
  taskOrigin:null,
  profileOrigin:null
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
function ensureTaskModeStyles(){
  if($('tpfWaTaskModeStyles'))return;
  const style=document.createElement('style');
  style.id='tpfWaTaskModeStyles';
  style.textContent=`
    #contactModal.tpf-wa-task-mode{overflow:hidden!important}
    #contactModal.tpf-wa-task-mode>.contactProfile>.cpTop{display:none!important}
    #contactModal.tpf-wa-task-mode #cpTaskPage,
    #contactModal.tpf-wa-task-mode #cpTaskDetailPage,
    #contactModal.tpf-wa-task-mode #tpfWaTasksPage{
      position:fixed!important;
      inset:0!important;
      width:100vw!important;
      height:100vh!important;
      min-height:100vh!important;
      max-height:100vh!important;
      overflow:hidden!important;
      z-index:51000!important;
      background:#f4f7fb!important;
    }
    #contactModal.tpf-wa-task-mode .cpTaskPageTop{
      top:0!important;
      height:68px!important;
      min-height:68px!important;
      z-index:4!important;
    }
    #contactModal.tpf-wa-task-mode .cpTaskPageBody{
      height:calc(100vh - 68px)!important;
      max-height:calc(100vh - 68px)!important;
      min-height:0!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      margin:0 auto!important;
      padding-top:24px!important;
      padding-bottom:36px!important;
      align-content:start!important;
      -webkit-overflow-scrolling:touch;
      scrollbar-gutter:stable;
    }
    #contactModal.tpf-wa-task-mode #tpfWaTasksPage .cpTaskPageBody{
      display:block!important;
      max-width:1100px!important;
      width:100%!important;
    }
    #contactModal.tpf-wa-task-mode #tpfWaTasksPage .cpTaskFormCard{
      width:100%!important;
      max-width:none!important;
    }
    #tpfWaTasksList .cpTaskActions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:7px!important;flex-wrap:wrap!important}
    #tpfWaTasksList .cpTaskActions button{width:auto!important;white-space:nowrap!important}
    #tpfWaTasksList .tpfWaFocusedTaskToggle{color:#16733d!important;background:#eaf8ef!important;border-color:#cdebd8!important}
    #tpfWaTasksList .tpfWaFocusedTaskDelete{color:#b42318!important}
  `;
  document.head.appendChild(style);
}
function currentChatId(){
  let chatId='';
  try{chatId=String(waLiveState?.selected?.id||'')}catch(_){}
  return chatId
}
function rememberTaskOrigin(returnTo='chat'){
  state.taskOrigin={chatId:state.taskOrigin?.chatId||currentChatId(),returnTo};
}
function enterTaskMode(returnTo='chat'){
  ensureTaskModeStyles();
  rememberTaskOrigin(returnTo);
  $('contactModal')?.classList.add('tpf-wa-task-mode');
}
function leaveTaskMode(){
  $('contactModal')?.classList.remove('tpf-wa-task-mode');
  state.taskOrigin=null;
}
async function backToWhatsapp(e){
  stop(e);
  const origin=state.taskOrigin;
  window.TPFAgendaComposer?.close?.({silent:true});
  $('cpTaskPage')?.classList.add('hidden');
  $('cpTaskDetailPage')?.classList.add('hidden');
  $('tpfWaTasksPage')?.classList.add('hidden');
  hideContactModal();
  leaveTaskMode();

  const waView=$('view-whatsapplive');
  if(waView?.classList.contains('hidden')){
    const nav=document.querySelector('.nav[data-view="whatsapplive"]');
    if(nav){nav.dataset.tpfBackNavigation='1';nav.click();delete nav.dataset.tpfBackNavigation;}
    await new Promise(r=>setTimeout(r,80));
  }
  if(origin?.chatId){
    let selected='';
    try{selected=String(waLiveState?.selected?.id||'')}catch(_){}
    if(selected!==origin.chatId&&typeof window.selectWhatsAppChat==='function'){
      try{await window.selectWhatsAppChat(origin.chatId)}catch(_){}
    }
  }
}
async function backProfileToWhatsapp(e){
  stop(e);const origin=state.profileOrigin;state.profileOrigin=null;
  hideContactModal();
  const waView=$('view-whatsapplive');
  if(waView?.classList.contains('hidden')){
    const nav=document.querySelector('.nav[data-view="whatsapplive"]');
    if(nav){nav.dataset.tpfBackNavigation='1';nav.click();delete nav.dataset.tpfBackNavigation}
    await new Promise(resolve=>setTimeout(resolve,80))
  }
  if(origin?.chatId&&currentChatId()!==origin.chatId&&typeof window.selectWhatsAppChat==='function')try{await window.selectWhatsAppChat(origin.chatId)}catch(_){}
}
async function backFromTaskDetail(e){
  if(state.taskOrigin?.returnTo!=='tasks')return backToWhatsapp(e);
  stop(e);$('cpTaskDetailPage')?.classList.add('hidden');state.taskOrigin.returnTo='chat';await showFocusedTasksPage()
}
function revealTaskDetail(){
  detachTaskDetail();
  enterTaskMode(state.taskOrigin?.returnTo||'chat');
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
      const relatedId=String(item.related_record_id||'').trim();
      if(relatedId)return relatedId===String(c.id);
      return (phone&&itemPhone===phone)||(name&&itemName===name);
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
  leaveTaskMode();
  const c=contact();
  if(!c)return alert('Primero vincula este chat con un contacto.');
  hideFocusedTasks();
  if(typeof window.openWaMatchedContact==='function')return window.openWaMatchedContact();
  state.profileOrigin={chatId:currentChatId()};
  if(typeof window.openContact==='function')await window.openContact(c.id);
}
async function openEdit(e){
  stop(e);
  leaveTaskMode();
  const c=contact();
  if(!c)return alert('Primero vincula este chat con un contacto.');
  hideFocusedTasks();
  if(typeof window.openWaMatchedContact==='function')await window.openWaMatchedContact();
  else{
    if(typeof window.openContact!=='function')return;
    state.profileOrigin={chatId:currentChatId()};
    await window.openContact(c.id);
  }
  $('tpfContactEditToggle')?.click();
}
async function createOpportunity(e){
  stop(e);
  leaveTaskMode();
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
function contactTaskPrefill(extra={}){
  const c=contact(),d=c?.data||{},name=String(d['NOMBRE Y APELLIDOS']||[d.NOMBRE,d.APELLIDOS].filter(Boolean).join(' ')||d.CLIENTE||'Contacto').trim();
  const chatPhone=typeof waNormalizePhone==='function'?waNormalizePhone(currentChatId()):currentChatId(),phone=digits(d['TELÉFONO']||d.TELEFONO||d.PHONE||d.MOVIL||chatPhone);
  return {overlay:true,type:'Tarea',title:extra.title||('Llamar a '+name),description:extra.description||'',customerName:name,phone,contactId:c?.id||'',startsAt:extra.startsAt||new Date(Date.now()+60*60*1000)}
}
async function restoreTaskOrigin(){
  const c=contact();
  if(c&&typeof loadWaContactSideData==='function'){
    const phone=typeof waNormalizePhone==='function'?waNormalizePhone(currentChatId()):currentChatId();
    try{await loadWaContactSideData(c,phone)}catch(_){}
  }
  if(state.taskOrigin?.returnTo==='tasks'){
    state.taskOrigin.returnTo='chat';
    await showFocusedTasksPage();
    return
  }
  await backToWhatsapp()
}
function createTask(e,extra={}){
  stop(e);
  if(!requireContact())return;
  const fromList=!!e?.target?.closest?.('#tpfWaTasksPage');
  rememberTaskOrigin(fromList?'tasks':'chat');
  hideFocusedTasks();
  hideContactModal();
  $('cpTaskPage')?.classList.add('hidden');
  $('cpTaskDetailPage')?.classList.add('hidden');
  const open=window.openAgendaComposer||window.TPFAgendaComposer?.open;
  if(typeof open!=='function'){state.taskOrigin=null;return alert('No está disponible el compositor de Agenda.')}
  open(contactTaskPrefill(extra),{overlay:true,onSaved:restoreTaskOrigin,onCancel:restoreTaskOrigin});
}
async function openTask(id,e,returnTo){
  stop(e);
  if(!id||!requireContact())return;
  const target=returnTo||(e?.target?.closest?.('#tpfWaTasksPage')?'tasks':'chat');
  detachTaskDetail();
  hideFocusedTasks();
  hideContactModal();
  $('cpTaskPage')?.classList.add('hidden');
  $('cpTaskDetailPage')?.classList.add('hidden');
  rememberTaskOrigin(target);
  if(typeof window.openContactTaskDetail==='function'){
    await window.openContactTaskDetail(String(id),{
      overlay:true,onSaved:restoreTaskOrigin,onCancel:restoreTaskOrigin
    });
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
  $('tpfWaTasksBack').onclick=backToWhatsapp;
  $('tpfWaTasksNew').onclick=createTask;
  return page;
}
async function viewTasks(e){
  stop(e);
  if(!requireContact())return;
  rememberTaskOrigin('chat');
  await showFocusedTasksPage();
}
async function refreshFocusedTaskSurfaces(){
  try{if(typeof loadAgenda==='function')await loadAgenda()}catch(_){}
  try{if(typeof renderContactProfile==='function')await renderContactProfile()}catch(_){}
  scheduleTaskSync(20);
}
async function toggleFocusedTask(task,e){
  stop(e);if(!task?.id)return;
  const next=task.status==='completed'||task.status==='cancelled'?'pending':'completed';
  try{
    const {error}=await sb.from('agenda_items').update({status:next}).eq('id',task.id);if(error)throw error;
    const c=contact();if(c&&typeof logContactActivity==='function')await logContactActivity(c.id,next==='completed'?'task_done':'task_reopened',next==='completed'?'Tarea completada':'Tarea reabierta',task.title||'');
    await refreshFocusedTaskSurfaces();await renderFocusedTasks()
  }catch(err){alert(err?.message||'No se pudo actualizar la tarea.')}
}
async function deleteFocusedTask(task,e){
  stop(e);if(!task?.id||!confirm(`¿Eliminar "${task.title||'Tarea'}"? Se enviará a la Papelera.`))return false;
  try{
    if(typeof archiveToTrash==='function'){const saved=await archiveToTrash('agenda',task.id,task.title||'Tarea',{agenda:task});if(!saved)throw new Error('No se pudo guardar la tarea en la Papelera.')}
    const {error}=await sb.from('agenda_items').delete().eq('id',task.id);if(error)throw error;
    const c=contact();if(c&&typeof logContactActivity==='function')await logContactActivity(c.id,'task_deleted','Tarea eliminada',task.title||'');
    await refreshFocusedTaskSurfaces();await renderFocusedTasks();return true
  }catch(err){alert(err?.message||'No se pudo eliminar la tarea.');return false}
}
async function renderFocusedTasks(){
  const list=$('tpfWaTasksList');if(!list)return;
  const tasks=await relatedTasks();
  list.innerHTML=tasks.length?tasks.map(task=>{
    const completed=task.status==='completed',cancelled=task.status==='cancelled';
    const status=completed?'Completada':cancelled?'Cancelada':'Pendiente';
    const toggle=completed||cancelled?'Reabrir':'Completar';
    return `<div class="cpTaskWrap" data-task-id="${esc(task.id)}"><button class="cpTask cpTaskButton" type="button"><b>${esc(task.title||task.subject||'Tarea')}</b><span>${task.starts_at?esc(new Date(task.starts_at).toLocaleString('es-ES')):''}</span><small>${status}</small></button><div class="cpTaskActions"><button class="tpfWaFocusedTaskEdit" type="button">Abrir / editar</button><button class="tpfWaFocusedTaskToggle" type="button">${toggle}</button><button class="tpfWaFocusedTaskDelete dangerText" type="button">Eliminar</button></div></div>`
  }).join(''):'<div class="cpEmpty">No hay tareas.</div>';
  list.querySelectorAll('[data-task-id]').forEach(row=>{
    const task=tasks.find(item=>String(item.id)===String(row.dataset.taskId));if(!task)return;
    row.querySelector('.cpTaskButton').onclick=event=>openTask(task.id,event,'tasks');
    row.querySelector('.tpfWaFocusedTaskEdit').onclick=event=>openTask(task.id,event,'tasks');
    row.querySelector('.tpfWaFocusedTaskToggle').onclick=event=>toggleFocusedTask(task,event);
    row.querySelector('.tpfWaFocusedTaskDelete').onclick=event=>deleteFocusedTask(task,event);
  })
}
async function showFocusedTasksPage(){
  detachTaskDetail();
  const page=ensureTasksPage();
  if(!page)return;
  await renderFocusedTasks();
  $('cpTaskPage')?.classList.add('hidden');
  $('cpTaskDetailPage')?.classList.add('hidden');
  enterTaskMode('chat');
  showContactModal();
  page.classList.remove('hidden');
  page.querySelector('.cpTaskPageBody')?.scrollTo?.({top:0});
}
function viewOpportunities(e){
  stop(e);
  leaveTaskMode();
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
  if(state.taskOrigin&&target.closest('#cpTaskDelete')){
    stop(e);
    let task=null;
    try{task=typeof currentContactTask!=='undefined'?currentContactTask:null}catch(_){}
    if(!task)return;
    const returnTo=state.taskOrigin.returnTo;
    if(!await deleteFocusedTask(task))return;
    try{currentContactTask=null}catch(_){}
    $('cpTaskDetailPage')?.classList.add('hidden');
    if(returnTo==='tasks')await showFocusedTasksPage();
    else await backToWhatsapp();
    return;
  }
  if(state.profileOrigin&&target.closest('#contactClose'))return backProfileToWhatsapp(e);
  if(state.taskOrigin&&target.closest('#cpTaskDetailBack'))return backFromTaskDetail(e);
  if(state.taskOrigin&&target.closest('#cpTaskBack,#tpfWaTasksBack'))return backToWhatsapp(e);
  if(target.closest('#waMsgTask')){
    const description=(()=>{try{return typeof waMessageText==='function'?waMessageText(waSelectedActionMessage)||'':''}catch(_){return''}})();
    $('waMsgActionModal')?.classList.add('hidden');return createTask(e,{title:'Seguimiento WhatsApp',description})
  }
  if(target.closest('#waMsgReminder')){
    const description=(()=>{try{return typeof waMessageText==='function'?waMessageText(waSelectedActionMessage)||'':''}catch(_){return''}})();
    $('waMsgActionModal')?.classList.add('hidden');return createTask(e,{title:'Recordatorio WhatsApp',description,startsAt:new Date(Date.now()+24*60*60*1000)})
  }
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
  ensureTaskModeStyles();
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

window.TPFWhatsAppContactConnector={bind,createOpportunity,createTask,openTask,viewTasks,viewOpportunities,syncTaskRows:syncTaskRowsNow,backToWhatsapp};
if(!state.registered){
  state.registered=true;
  M.register('whatsapp-contact-reuse',{install(){bind();setTimeout(bind,120);setTimeout(bind,600);}});
}else{
  bind();
}
})();
